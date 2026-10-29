import { useEffect, useRef } from 'react'
import type { Reel } from '@/types/db'

const SCRIPT_ID = 'tiktok-embed-js'

/**
 * TikTok's official embed: a <blockquote class="tiktok-embed"> that TikTok's embed.js turns into the player.
 * The markup is built with DOM calls (never innerHTML) so nothing from the database is interpreted as HTML.
 * embed.js only scans the page when it loads, so it is re-added each time a new embed is mounted.
 */
export function TikTokEmbed({ reel }: { reel: Reel }) {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = host.current
    if (!el) return
    el.textContent = ''
    const bq = document.createElement('blockquote')
    bq.className = 'tiktok-embed'
    bq.setAttribute('cite', reel.tiktok_url)
    bq.setAttribute('data-video-id', reel.video_id)
    bq.style.maxWidth = '605px'
    bq.style.minWidth = '325px'
    const section = document.createElement('section')
    const link = document.createElement('a')
    link.href = reel.tiktok_url
    link.target = '_blank'
    link.rel = 'noopener noreferrer'
    link.textContent = reel.title || 'Watch on TikTok'
    section.appendChild(link)
    bq.appendChild(section)
    el.appendChild(bq)

    document.getElementById(SCRIPT_ID)?.remove()
    const s = document.createElement('script')
    s.id = SCRIPT_ID
    s.async = true
    s.src = 'https://www.tiktok.com/embed.js'
    document.body.appendChild(s)

    return () => {
      el.textContent = ''
    }
  }, [reel.tiktok_url, reel.video_id, reel.title])

  return <div ref={host} className="tiktok-host" />
}
