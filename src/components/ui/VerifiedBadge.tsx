/** Blue seal with a check, shown next to the name of an account that has a badge. */
export function VerifiedBadge({ badge, size = 16 }: { badge?: 'verified' | 'professional' | null; size?: number }) {
  if (!badge) return null
  const label = badge === 'professional' ? 'Professional account' : 'Verified account'
  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ flex: 'none', verticalAlign: '-0.15em', marginLeft: 4 }}
    >
      <title>{label}</title>
      <g fill="#0a84ff">
        <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
        <rect x="3.5" y="3.5" width="17" height="17" rx="4" transform="rotate(45 12 12)" />
      </g>
      <path d="M8 12.4l2.7 2.7L16.2 9.4" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
