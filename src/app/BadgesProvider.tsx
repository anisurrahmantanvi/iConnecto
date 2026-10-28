import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './AuthProvider'
import { subscribeNotifications, unreadNotificationCount } from '@/services/notifications'
import { listChats, subscribeAnyMessage } from '@/services/chat'

interface BadgesApi {
  unreadNotifications: number
  unreadMessages: number
  refreshNotifications: () => void
  refreshMessages: () => void
  clearNotifications: () => void
}

const BadgesContext = createContext<BadgesApi>({
  unreadNotifications: 0,
  unreadMessages: 0,
  refreshNotifications: () => undefined,
  refreshMessages: () => undefined,
  clearNotifications: () => undefined,
})

/** One shared realtime subscription each for notifications and messages (keeps Supabase Free usage low). */
export function BadgesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [unreadNotifications, setN] = useState(0)
  const [unreadMessages, setM] = useState(0)

  const refreshNotifications = useCallback(() => {
    if (!userId) return
    unreadNotificationCount().then(setN).catch(() => undefined)
  }, [userId])

  const refreshMessages = useCallback(() => {
    if (!userId) return
    listChats()
      .then((chats) => setM(chats.reduce((sum, c) => sum + c.unread_count, 0)))
      .catch(() => undefined)
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setN(0)
      setM(0)
      return
    }
    refreshNotifications()
    refreshMessages()
    const offN = subscribeNotifications(userId, refreshNotifications)
    const offM = subscribeAnyMessage(userId, refreshMessages)
    // Counts can go stale while the tab is hidden (realtime sockets pause); resync on return.
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        refreshNotifications()
        refreshMessages()
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      offN()
      offM()
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }, [userId, refreshNotifications, refreshMessages])

  const value = useMemo<BadgesApi>(
    () => ({ unreadNotifications, unreadMessages, refreshNotifications, refreshMessages, clearNotifications: () => setN(0) }),
    [unreadNotifications, unreadMessages, refreshNotifications, refreshMessages],
  )
  return <BadgesContext.Provider value={value}>{children}</BadgesContext.Provider>
}

export function useBadges(): BadgesApi {
  return useContext(BadgesContext)
}
