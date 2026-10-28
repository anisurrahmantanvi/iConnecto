import { supabase, channelName } from '@/lib/supabase'
import { check } from '@/lib/api'
import type { ChatSummary, Message, Page } from '@/types/db'

export const MESSAGE_PAGE = 30
export const MAX_MESSAGE_LENGTH = 4000

export async function listChats(): Promise<ChatSummary[]> {
  const rows = check(await supabase.rpc('my_chats')) as ChatSummary[] | null
  return (rows ?? []).map((r) => ({ ...r, unread_count: Number(r.unread_count) }))
}

export interface ChatPeer {
  other_id: string
  other_username: string
  other_display_name: string | null
  other_avatar_url: string | null
}

/** The other person in a chat, available even before the first message is sent. Null if the user is not a member. */
export async function getChatPeer(chatId: string): Promise<ChatPeer | null> {
  const rows = check(await supabase.rpc('chat_peer', { p_chat: chatId })) as ChatPeer[] | null
  return rows?.[0] ?? null
}

export async function getOrCreateDm(otherUserId: string): Promise<string> {
  return check(await supabase.rpc('get_or_create_dm', { p_other: otherUserId })) as string
}

/** Newest first. The UI reverses each page for display. */
export async function fetchMessages(chatId: string, cursor: string | null): Promise<Page<Message>> {
  let q = supabase
    .from('messages')
    .select('id, chat_id, sender_id, content, created_at')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(MESSAGE_PAGE)
  if (cursor) q = q.lt('created_at', cursor)
  const items = check(await q) as Message[]
  return { items, nextCursor: items.length === MESSAGE_PAGE ? items[items.length - 1].created_at : null }
}

export async function sendMessage(chatId: string, content: string): Promise<Message> {
  const text = content.trim()
  if (!text) throw new Error('Type a message first.')
  if (text.length > MAX_MESSAGE_LENGTH) throw new Error(`Messages can be up to ${MAX_MESSAGE_LENGTH} characters.`)
  const res = await supabase
    .from('messages')
    .insert({ chat_id: chatId, content: text })
    .select('id, chat_id, sender_id, content, created_at')
    .single()
  return check(res) as Message
}

export async function markChatRead(chatId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_chat_read', { p_chat: chatId })
  if (error) throw new Error(error.message)
}

export async function deleteMessage(id: string): Promise<void> {
  const { error } = await supabase.from('messages').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** New messages in one conversation. RLS ensures only members receive events. */
export function subscribeChat(chatId: string, onMessage: (m: Message) => void, onStatus?: (status: string) => void): () => void {
  const channel = supabase
    .channel(channelName(`chat:${chatId}`))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, (payload) => onMessage(payload.new as Message))
    .subscribe((status) => onStatus?.(status))
  return () => {
    void supabase.removeChannel(channel)
  }
}

/** Any new message the user can see (used for inbox refresh and the unread badge). */
export function subscribeAnyMessage(userId: string, onMessage: (m: Message) => void): () => void {
  const channel = supabase
    .channel(channelName(`inbox:${userId}`))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => onMessage(payload.new as Message))
    .subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}
