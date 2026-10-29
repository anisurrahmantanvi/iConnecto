import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from './AuthProvider'
import { fetchNotifications, subscribeNotifications, unreadNotificationCount } from '@/services/notifications'
import { getChatPeer, listChats, subscribeAnyMessage } from '@/services/chat'
import { notificationPermission, showSystemNotification, type NotifyPermission } from '@/lib/systemNotify'
import type { AppNotification, Message } from '@/types/db'

const NOTE_TEXT: Record<AppNotification['type'], string> = {
  follow: 'started following you',
  like: 'liked your post',
  comment: 'commented on your post',
  reply: 'replied to your comment',
  community_join: 'joined your community',
}

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
  const permission = useRef<NotifyPermission>('default')

  // System notifications are shown only when the app is in the background (the in-app badges cover the visible case).
  useEffect(() => {
    if (!userId) return
    const refresh = () => void notificationPermission().then((p) => (permission.current = p))
    refresh()
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [userId])
  const shouldNotify = () => permission.current === 'granted' && document.hidden

  const notifyMessage = async (m: Message) => {
    if (!shouldNotify() || m.sender_id === userId) return
    const peer = await getChatPeer(m.chat_id).catch(() => null)
    await showSystemNotification(peer?.other_display_name || peer?.other_username || 'New message', m.content.slice(0, 120), `chat-${m.chat_id}`)
  }
  const notifyActivity = async () => {
    if (!shouldNotify()) return
    const latest = (await fetchNotifications(null).catch(() => null))?.items[0]
    if (!latest || latest.is_read) return
    const who = latest.actor?.display_name || latest.actor?.username || 'Someone'
    await showSystemNotification('iConnecto', `${who} ${NOTE_TEXT[latest.type] ?? 'sent you a notification'}`, `note-${latest.id}`)
  }
  const handlers = useRef({ notifyMessage, notifyActivity })
  handlers.current = { notifyMessage, notifyActivity }

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
    const offN = subscribeNotifications(userId, () => {
      refreshNotifications()
      void handlers.current.notifyActivity()
    })
    const offM = subscribeAnyMessage(userId, (m) => {
      refreshMessages()
      void handlers.current.notifyMessage(m)
    })
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
