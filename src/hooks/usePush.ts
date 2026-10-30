import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { enablePush, pushAvailable } from '@/lib/push'

/** In the Android app: ask for notification permission when the user is signed in, and register the phone for push. */
export function usePush(enabled: boolean): void {
  const navigate = useNavigate()
  useEffect(() => {
    if (!enabled || !pushAvailable()) return
    void enablePush((url) => navigate(url)).catch((e) => console.warn('Push setup failed', e))
  }, [enabled, navigate])
}
