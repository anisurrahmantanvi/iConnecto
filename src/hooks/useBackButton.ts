import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'

/**
 * Android back button, inside the app.
 * Goes back one screen. If there is nothing to go back to, goes Home first, and only leaves the app from Home.
 * Does nothing in a browser or in an older app build that does not have the plugin.
 */
export function useBackButton(): void {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let remove: (() => void) | null = null
    let cancelled = false
    void App.addListener('backButton', () => {
      const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0
      if (idx > 0) navigate(-1)
      else if (location.pathname !== '/') navigate('/', { replace: true })
      else void App.exitApp()
    })
      .then((h) => {
        if (cancelled) void h.remove()
        else remove = () => void h.remove()
      })
      .catch(() => undefined) // plugin missing: the phone's default back behaviour stays
    return () => {
      cancelled = true
      remove?.()
    }
  }, [navigate, location.pathname])
}
