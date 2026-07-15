import { ThemeProvider } from './context/ThemeContext'
import Header from './components/Header'
import Hero from './components/Hero'
import Shields from './components/Shields'
import Vault from './components/Vault'
import Why from './components/Why'
import Privacy from './components/Privacy'
import Download from './components/Download'
import Footer from './components/Footer'

export default function App() {
  return (
    <ThemeProvider>
      <div className="atmosphere" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />
      <Header />
      <main>
        <Hero />
        <Shields />
        <Vault />
        <Why />
        <Privacy />
        <Download />
      </main>
      <Footer />
    </ThemeProvider>
  )
}
