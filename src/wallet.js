/**
 * Anon Vault — real BIP84 (native segwit) hot wallet / watch-only wallet.
 *
 * - Secret (BIP39 mnemonic or account xpub) is encrypted at rest with a
 *   passphrase (scrypt -> AES-256-GCM), additionally wrapped with Electron
 *   safeStorage (OS keychain) when available.
 * - Chain data (balance, txs, utxos) lives in memory only while unlocked;
 *   nothing about funds is persisted in plaintext.
 * - Chain source: mempool.space Esplora REST API (mainnet or testnet).
 * - Amounts are integer sats, shown as sats or BTC.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { app, safeStorage } = require('electron');
const { formatCoin } = require('../vault/coins');

const GAP_LIMIT = 10;
const SCAN_BATCH = 4;
const DUST = 546n;
const AUTO_LOCK_MS = 15 * 60 * 1000;

let libs = null; // { bip39, wordlist, HDKey, btc, qrcode }

async function loadLibs() {
  if (libs) return libs;
  const [bip39, english, bip32, btc, qrcode] = await Promise.all([
    import('@scure/bip39'),
    import('@scure/bip39/wordlists/english.js'),
    import('@scure/bip32'),
    import('@scure/btc-signer'),
    import('qrcode'),
  ]);
  libs = {
    bip39,
    wordlist: english.wordlist,
    HDKey: bip32.HDKey,
    btc,
    qrcode: qrcode.default || qrcode,
  };
  return libs;
}

// ---------------------------------------------------------------------------
// base58check (for zpub/vpub -> xpub/tpub version-byte conversion)

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function b58decode(str) {
  let n = 0n;
  for (const c of str) {
    const i = B58.indexOf(c);
    if (i < 0) throw new Error('Invalid base58');
    n = n * 58n + BigInt(i);
  }
  const bytes = [];
  while (n > 0n) {
    bytes.unshift(Number(n & 0xffn));
    n >>= 8n;
  }
  for (const c of str) {
    if (c === '1') bytes.unshift(0);
    else break;
  }
  return Buffer.from(bytes);
}

function b58encode(buf) {
  let n = 0n;
  for (const b of buf) n = (n << 8n) + BigInt(b);
  let out = '';
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of buf) {
    if (b === 0) out = '1' + out;
    else break;
  }
  return out;
}

function sha256d(buf) {
  const a = crypto.createHash('sha256').update(buf).digest();
  return crypto.createHash('sha256').update(a).digest();
}

/** Convert zpub/vpub (BIP84 version bytes) to xpub/tpub so HDKey can parse. */
function normalizeXpub(input) {
  const s = input.trim();
  if (/^xpub/.test(s) || /^tpub/.test(s)) return s;
  if (!/^[zv]pub/.test(s)) return s;
  const raw = b58decode(s);
  const payload = raw.subarray(0, raw.length - 4);
  const check = raw.subarray(raw.length - 4);
  if (!sha256d(payload).subarray(0, 4).equals(check)) {
    throw new Error('Invalid extended key checksum');
  }
  const version = s.startsWith('zpub')
    ? Buffer.from([0x04, 0x88, 0xb2, 0x1e]) // xpub
    : Buffer.from([0x04, 0x35, 0x87, 0xcf]); // tpub
  const swapped = Buffer.concat([version, payload.subarray(4)]);
  return b58encode(Buffer.concat([swapped, sha256d(swapped).subarray(0, 4)]));
}

// ---------------------------------------------------------------------------
// At-rest encryption

/**
 * Scrypt parameters (explicit):
 * N=16384 (2^14), r=8, p=1
 * ~100ms on modern hardware, memory cost ~16MB
 */
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };

function encryptSecret(passphrase, secretObj) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(passphrase, salt, 32, SCRYPT_PARAMS);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([
    cipher.update(JSON.stringify(secretObj), 'utf8'),
    cipher.final(),
  ]);
  const blob = {
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    tag: cipher.getAuthTag().toString('hex'),
    data: data.toString('hex'),
  };
  if (safeStorage.isEncryptionAvailable()) {
    return {
      wrapped: true,
      data: safeStorage.encryptString(JSON.stringify(blob)).toString('base64'),
    };
  }
  return { wrapped: false, ...blob };
}

function decryptSecret(passphrase, enc) {
  let blob = enc;
  if (enc.wrapped) {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('OS keychain unavailable');
    }
    blob = JSON.parse(safeStorage.decryptString(Buffer.from(enc.data, 'base64')));
  }
  const key = crypto.scryptSync(passphrase, Buffer.from(blob.salt, 'hex'), 32, SCRYPT_PARAMS);
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(blob.iv, 'hex')
  );
  decipher.setAuthTag(Buffer.from(blob.tag, 'hex'));
  try {
    const out = Buffer.concat([
      decipher.update(Buffer.from(blob.data, 'hex')),
      decipher.final(),
    ]);
    return JSON.parse(out.toString('utf8'));
  } catch {
    throw new Error('Wrong passphrase');
  }
}

// ---------------------------------------------------------------------------

function vaultPath() {
  return path.join(app.getPath('userData'), 'vault.json');
}

function loadFile() {
  try {
    const data = JSON.parse(fs.readFileSync(vaultPath(), 'utf8'));
    if (data && data.version === 2) return data;
    // Legacy toy vault from the MVP — park it and start fresh
    fs.renameSync(vaultPath(), vaultPath().replace(/\.json$/, '-legacy.json'));
    return null;
  } catch {
    return null;
  }
}

function saveFile(data) {
  fs.mkdirSync(path.dirname(vaultPath()), { recursive: true });
  const filePath = vaultPath();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
  // Ensure restrictive permissions (user read/write only)
  try {
    fs.chmodSync(filePath, 0o600);
  } catch (err) {
    // Windows doesn't support chmod the same way; safeStorage provides OS-level protection there
  }
}

class Wallet {
  constructor() {
    this.file = loadFile();
    this.mem = null; // unlocked state
    this.lastActivity = 0;
  }

  touch() {
    this.lastActivity = Date.now();
  }

  get created() {
    return !!this.file;
  }

  get unlocked() {
    return !!this.mem;
  }

  network() {
    return (this.mem ? this.mem.network : this.file?.network) || 'mainnet';
  }

  apiBase() {
    return this.network() === 'testnet'
      ? 'https://mempool.space/testnet/api'
      : 'https://mempool.space/api';
  }

  btcNetwork() {
    return this.network() === 'testnet' ? libs.btc.TEST_NETWORK : libs.btc.NETWORK;
  }

  // -- lifecycle ------------------------------------------------------------

  /** Create a brand-new seed wallet. Returns the mnemonic exactly once. */
  async create(passphrase, network = 'mainnet') {
    await loadLibs();
    if (this.file) throw new Error('Wallet already exists');
    if (!passphrase || passphrase.length < 8) {
      throw new Error('Passphrase must be at least 8 characters');
    }
    const mnemonic = libs.bip39.generateMnemonic(libs.wordlist);
    this.file = {
      version: 2,
      created: true,
      watchOnly: false,
      network,
      enc: encryptSecret(passphrase, { mnemonic }),
    };
    saveFile(this.file);
    await this.unlockWith({ mnemonic }, network);
    return mnemonic;
  }

  /** Import a mnemonic (hot) or xpub/zpub (watch-only). */
  async import(passphrase, secretInput, network = 'mainnet') {
    await loadLibs();
    if (this.file) throw new Error('Wallet already exists');
    if (!passphrase || passphrase.length < 8) {
      throw new Error('Passphrase must be at least 8 characters');
    }
    const input = String(secretInput || '').trim();
    if (!input) throw new Error('Enter a recovery phrase or xpub');

    let secret;
    let watchOnly;
    if (/^[xztuv]pub[a-zA-Z0-9]+$/.test(input)) {
      const xpub = normalizeXpub(input);
      libs.HDKey.fromExtendedKey(xpub, this.versionsFor(network)); // validates
      secret = { xpub };
      watchOnly = true;
    } else {
      const mnemonic = input.toLowerCase().replace(/\s+/g, ' ');
      if (!libs.bip39.validateMnemonic(mnemonic, libs.wordlist)) {
        throw new Error('Invalid recovery phrase');
      }
      secret = { mnemonic };
      watchOnly = false;
    }
    this.file = {
      version: 2,
      created: true,
      watchOnly,
      network,
      enc: encryptSecret(passphrase, secret),
    };
    saveFile(this.file);
    await this.unlockWith(secret, network);
  }

  async unlock(passphrase) {
    await loadLibs();
    if (!this.file) throw new Error('No wallet');
    const secret = decryptSecret(passphrase, this.file.enc);
    await this.unlockWith(secret, this.file.network);
  }

  versionsFor(network) {
    return network === 'testnet'
      ? { private: 0x04358394, public: 0x043587cf }
      : { private: 0x0488ade4, public: 0x0488b21e };
  }

  async unlockWith(secret, network) {
    await loadLibs();
    let account;
    if (secret.mnemonic) {
      const seed = libs.bip39.mnemonicToSeedSync(secret.mnemonic);
      const root = libs.HDKey.fromMasterSeed(seed, this.versionsFor(network));
      const coin = network === 'testnet' ? 1 : 0;
      account = root.derive(`m/84'/${coin}'/0'`);
    } else {
      account = libs.HDKey.fromExtendedKey(
        normalizeXpub(secret.xpub),
        this.versionsFor(network)
      );
    }
    this.mem = {
      network,
      watchOnly: !secret.mnemonic,
      account,
      scan: null,
      syncing: false,
      syncError: null,
      feeRates: null,
    };
    this.touch();
    this.sync().catch(() => {});
  }

  lock() {
    this.mem = null;
  }

  maybeAutoLock() {
    if (this.mem && Date.now() - this.lastActivity > AUTO_LOCK_MS) {
      this.lock();
      return true;
    }
    return false;
  }

  /** Forget the wallet entirely (requires passphrase). */
  async destroy(passphrase) {
    if (!this.file) throw new Error('No wallet');
    decryptSecret(passphrase, this.file.enc); // throws on wrong passphrase
    fs.rmSync(vaultPath(), { force: true });
    this.file = null;
    this.mem = null;
  }

  // -- derivation -----------------------------------------------------------

  node(chain, index) {
    return this.mem.account.deriveChild(chain).deriveChild(index);
  }

  address(chain, index) {
    const pay = libs.btc.p2wpkh(this.node(chain, index).publicKey, this.btcNetwork());
    return { address: pay.address, script: pay.script };
  }

  // -- chain sync -----------------------------------------------------------

  async api(pathname, init) {
    const res = await fetch(`${this.apiBase()}${pathname}`, init);
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`API ${res.status}: ${body.slice(0, 120) || pathname}`);
    }
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  async scanChain(chain) {
    const found = [];
    let index = 0;
    let gap = 0;
    while (gap < GAP_LIMIT) {
      const batch = [];
      for (let i = 0; i < SCAN_BATCH; i++) batch.push(index + i);
      const results = await Promise.all(
        batch.map(async (i) => {
          const { address, script } = this.address(chain, i);
          const stats = await this.api(`/address/${address}`);
          return { chain, index: i, address, script, stats };
        })
      );
      for (const r of results) {
        const used =
          r.stats.chain_stats.tx_count > 0 || r.stats.mempool_stats.tx_count > 0;
        if (used) {
          gap = 0;
          found.push(r);
        } else {
          gap += 1;
          found.push(r);
          if (gap >= GAP_LIMIT) break;
        }
      }
      index += SCAN_BATCH;
      if (index > 200) break; // sanity cap
    }
    return found;
  }

  async sync() {
    if (!this.mem || this.mem.syncing) return;
    this.mem.syncing = true;
    this.mem.syncError = null;
    try {
      const [receive, change, fees] = await Promise.all([
        this.scanChain(0),
        this.scanChain(1),
        this.api('/v1/fees/recommended').catch(() => null),
      ]);
      if (!this.mem) return;

      const all = [...receive, ...change];
      const used = all.filter(
        (r) => r.stats.chain_stats.tx_count > 0 || r.stats.mempool_stats.tx_count > 0
      );

      let confirmed = 0n;
      let pending = 0n;
      for (const r of used) {
        confirmed +=
          BigInt(r.stats.chain_stats.funded_txo_sum) -
          BigInt(r.stats.chain_stats.spent_txo_sum);
        pending +=
          BigInt(r.stats.mempool_stats.funded_txo_sum) -
          BigInt(r.stats.mempool_stats.spent_txo_sum);
      }

      const nextReceive =
        receive.find(
          (r) => r.stats.chain_stats.tx_count === 0 && r.stats.mempool_stats.tx_count === 0
        )?.index ?? receive.length;
      const nextChange =
        change.find(
          (r) => r.stats.chain_stats.tx_count === 0 && r.stats.mempool_stats.tx_count === 0
        )?.index ?? change.length;

      // Recent transactions across used addresses
      const ownScripts = new Map(all.map((r) => [r.address, r]));
      const txMap = new Map();
      for (const r of used.slice(0, 12)) {
        const txs = await this.api(`/address/${r.address}/txs`).catch(() => []);
        for (const tx of txs) txMap.set(tx.txid, tx);
      }
      const txs = [...txMap.values()]
        .map((tx) => {
          let net = 0n;
          for (const vout of tx.vout) {
            if (vout.scriptpubkey_address && ownScripts.has(vout.scriptpubkey_address)) {
              net += BigInt(vout.value);
            }
          }
          for (const vin of tx.vin) {
            const a = vin.prevout?.scriptpubkey_address;
            if (a && ownScripts.has(a)) net -= BigInt(vin.prevout.value);
          }
          return {
            txid: tx.txid,
            netCoins: net.toString(),
            formatted: formatCoin(net < 0n ? -net : net),
            direction: net < 0n ? 'send' : 'receive',
            confirmed: !!tx.status.confirmed,
            time: tx.status.block_time || null,
          };
        })
        .sort((a, b) => (b.time || Infinity) - (a.time || Infinity))
        .slice(0, 20);

      // Spendable UTXOs (with owning derivation path)
      const utxos = [];
      for (const r of used) {
        const list = await this.api(`/address/${r.address}/utxo`).catch(() => []);
        for (const u of list) {
          utxos.push({
            txid: u.txid,
            vout: u.vout,
            value: BigInt(u.value),
            confirmed: !!u.status.confirmed,
            chain: r.chain,
            index: r.index,
            script: r.script,
          });
        }
      }

      this.mem.scan = {
        confirmed,
        pending,
        nextReceive,
        nextChange,
        txs,
        utxos,
        syncedAt: Date.now(),
      };
      if (fees) this.mem.feeRates = fees;
    } catch (err) {
      if (this.mem) this.mem.syncError = err.message;
    } finally {
      if (this.mem) this.mem.syncing = false;
    }
  }

  // -- receive / send -------------------------------------------------------

  async receive() {
    if (!this.mem) throw new Error('Vault is locked');
    const index = this.mem.scan?.nextReceive ?? 0;
    const { address } = this.address(0, index);
    const uri = `bitcoin:${address}`;
    const qr = await libs.qrcode.toDataURL(uri, {
      margin: 1,
      width: 220,
      color: { dark: '#111113', light: '#e8e6e3' },
    });
    return { address, index, uri, qr };
  }

  estimateFee(nIn, nOut, rate) {
    const vsize = Math.ceil(10.5 + 68 * nIn + 31 * nOut);
    return BigInt(vsize * Math.max(1, Math.ceil(rate)));
  }

  selectInputs(amount, rate) {
    const utxos = (this.mem.scan?.utxos || [])
      .filter((u) => u.confirmed)
      .sort((a, b) => (b.value > a.value ? 1 : -1));
    const picked = [];
    let total = 0n;
    for (const u of utxos) {
      picked.push(u);
      total += u.value;
      const feeWithChange = this.estimateFee(picked.length, 2, rate);
      if (total >= amount + feeWithChange) {
        return { picked, total, fee: feeWithChange, change: total - amount - feeWithChange };
      }
      const feeNoChange = this.estimateFee(picked.length, 1, rate);
      if (total >= amount + feeNoChange) {
        return { picked, total, fee: feeNoChange, change: 0n };
      }
    }
    throw new Error('Insufficient confirmed balance');
  }

  async estimateSend(toAddress, amountCoins, feeRate) {
    if (!this.mem) throw new Error('Vault is locked');
    if (this.mem.watchOnly) throw new Error('Watch-only wallet cannot send');
    if (!this.mem.scan) throw new Error('Still syncing — try again shortly');
    libs.btc.Address(this.btcNetwork()).decode(String(toAddress).trim()); // validates
    const rate = feeRate || this.mem.feeRates?.halfHourFee || 4;
    const { picked, fee, change } = this.selectInputs(amountCoins, rate);
    return { inputs: picked.length, fee, change, rate };
  }

  async send(passphrase, toAddress, amountCoins, feeRate) {
    if (!this.mem) throw new Error('Vault is locked');
    if (this.mem.watchOnly) throw new Error('Watch-only wallet cannot send');
    if (!this.mem.scan) throw new Error('Still syncing — try again shortly');
    // Re-verify passphrase for every spend
    const secret = decryptSecret(passphrase, this.file.enc);
    if (!secret.mnemonic) throw new Error('No signing key');

    const to = String(toAddress).trim();
    libs.btc.Address(this.btcNetwork()).decode(to);
    if (amountCoins < DUST) throw new Error(`Minimum send is ${DUST} sats`);

    const rate = feeRate || this.mem.feeRates?.halfHourFee || 4;
    const { picked, fee, change } = this.selectInputs(amountCoins, rate);

    const tx = new libs.btc.Transaction();
    for (const u of picked) {
      tx.addInput({
        txid: u.txid,
        index: u.vout,
        witnessUtxo: { script: u.script, amount: u.value },
      });
    }
    tx.addOutputAddress(to, amountCoins, this.btcNetwork());
    let changeIndex = null;
    if (change >= DUST) {
      changeIndex = this.mem.scan.nextChange;
      const { address: changeAddr } = this.address(1, changeIndex);
      tx.addOutputAddress(changeAddr, change, this.btcNetwork());
    }

    picked.forEach((u, i) => {
      const key = this.node(u.chain, u.index).privateKey;
      tx.signIdx(key, i);
    });
    tx.finalize();

    const hex = Buffer.from(tx.extract()).toString('hex');
    const txid = await this.api('/tx', { method: 'POST', body: hex });
    this.sync().catch(() => {});
    return { txid: String(txid), fee: fee.toString() };
  }

  // -- state ----------------------------------------------------------------

  getState() {
    if (!this.file) {
      return { created: false, locked: true };
    }
    if (!this.mem) {
      return {
        created: true,
        locked: true,
        watchOnly: !!this.file.watchOnly,
        network: this.file.network,
      };
    }
    const scan = this.mem.scan;
    const confirmed = scan ? scan.confirmed : 0n;
    const pending = scan ? scan.pending : 0n;
    return {
      created: true,
      locked: false,
      watchOnly: this.mem.watchOnly,
      network: this.mem.network,
      syncing: this.mem.syncing,
      syncError: this.mem.syncError,
      synced: !!scan,
      syncedAt: scan?.syncedAt || null,
      balance: {
        confirmedCoins: confirmed.toString(),
        pendingCoins: pending.toString(),
        formatted: formatCoin(confirmed),
        pendingFormatted: pending !== 0n ? formatCoin(pending) : null,
      },
      txs: scan?.txs || [],
      feeRates: this.mem.feeRates,
    };
  }

  /** Minimal info for chrome badge — no balance while locked. */
  getSummary() {
    return {
      created: this.created,
      locked: !this.unlocked,
      balanceFormatted:
        this.unlocked && this.mem.scan ? formatCoin(this.mem.scan.confirmed) : null,
    };
  }
}

module.exports = { Wallet };
