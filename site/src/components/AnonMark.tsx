export default function AnonMark({ className = '' }: { className?: string }) {
  return (
    <img
      src="/anon-mark.png"
      alt=""
      className={`anon-mark ${className}`}
      width={682}
      height={1024}
      draggable={false}
    />
  )
}
