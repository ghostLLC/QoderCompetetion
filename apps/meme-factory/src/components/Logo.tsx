export function LogoMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className={className}>
      <rect
        x="2"
        y="2"
        width="44"
        height="44"
        rx="7"
        fill="#E8FF00"
        stroke="#111111"
        strokeWidth="4"
      />
      <circle cx="16.5" cy="19" r="3.4" fill="#111111" />
      <circle cx="31.5" cy="19" r="3.4" fill="#111111" />
      <path
        d="M14 29c2.6 4.2 6 6 10 6s7.4-1.8 10-6"
        fill="none"
        stroke="#111111"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Tilted sticker mark + wordmark. Used in the header and footer. */
export function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span className="inline-flex -rotate-3 border-[3px] border-ink bg-paper shadow-[3px_3px_0_0_var(--color-ink)]">
        <LogoMark className="h-9 w-9" />
      </span>
      <span className="font-display text-xl font-bold leading-none tracking-tight">
        斗图军火库
      </span>
    </span>
  )
}
