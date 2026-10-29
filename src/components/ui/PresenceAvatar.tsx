import { Avatar } from './Avatar'

/** An avatar with a small green dot while the person is online. */
export function PresenceAvatar({ online, ...rest }: { online: boolean } & Parameters<typeof Avatar>[0]) {
  return (
    <span className="presence-wrap">
      <Avatar {...rest} />
      {online ? <span className="presence-dot" role="img" aria-label="Online" /> : null}
    </span>
  )
}
