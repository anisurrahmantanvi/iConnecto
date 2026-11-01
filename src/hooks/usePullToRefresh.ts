import { useEffect } from 'react'

const THRESHOLD = 110

function scrolledAncestor(el: EventTarget | null): boolean {
  let n = el instanceof Element ? el : null
  while (n && n !== document.body) {
    if (n.scrollTop > 0) return true
    n = n.parentElement
  }
  return false
}

/** Pull down from the very top of a page to reload it (the app has no browser refresh button). Ignores chats and calls. */
export function usePullToRefresh(): void {
  useEffect(() => {
    let startY = 0
    let active = false
    let bar: HTMLDivElement | null = null
    const skip = () => /^\/(messages\/|call)/.test(location.pathname.replace(/^\/iConnecto/, ''))
    const clear = () => {
      active = false
      bar?.remove()
      bar = null
    }
    const start = (e: TouchEvent) => {
      if (skip() || e.touches.length !== 1 || window.scrollY > 0 || scrolledAncestor(e.target)) return
      startY = e.touches[0].clientY
      active = true
    }
    const move = (e: TouchEvent) => {
      if (!active) return
      const dy = e.touches[0].clientY - startY
      if (dy <= 0 || window.scrollY > 0) return clear()
      if (!bar) {
        bar = document.createElement('div')
        bar.setAttribute('aria-hidden', 'true')
        bar.style.cssText = 'position:fixed;top:0;left:0;height:3px;background:var(--accent,#7c5cff);z-index:9999;transition:none;'
        document.body.appendChild(bar)
      }
      bar.style.width = `${Math.min(100, (dy / THRESHOLD) * 100)}%`
    }
    const end = (e: TouchEvent) => {
      if (!active) return
      const dy = (e.changedTouches[0]?.clientY ?? startY) - startY
      clear()
      if (dy >= THRESHOLD) window.location.reload()
    }
    document.addEventListener('touchstart', start, { passive: true })
    document.addEventListener('touchmove', move, { passive: true })
    document.addEventListener('touchend', end, { passive: true })
    document.addEventListener('touchcancel', clear, { passive: true })
    return () => {
      document.removeEventListener('touchstart', start)
      document.removeEventListener('touchmove', move)
      document.removeEventListener('touchend', end)
      document.removeEventListener('touchcancel', clear)
      clear()
    }
  }, [])
}
