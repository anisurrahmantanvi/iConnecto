import { supabase, channelName } from '@/lib/supabase'
import { check } from '@/lib/api'
import type { ChatSummary, Message, MessageReaction, Page } from '@/types/db'

export const MESSAGE_PAGE = 30
export const MAX_MESSAGE_LENGTH = 4000
/** Edit and unsend are allowed for this long after sending. The database enforces it too. */
export const EDIT_WINDOW_MS = 2 * 60 * 1000

const BASE_COLS = 'id, chat_id, sender_id, content, created_at'
const FULL_COLS = `${BASE_COLS}, kind, edited_at, forwarded`

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
  const run = (cols: string) => {
    let q = supabase.from('messages').select(cols).eq('chat_id', chatId).order('created_at', { ascending: false }).limit(MESSAGE_PAGE)
    if (cursor) q = q.lt('created_at', cursor)
    return q
  }
  let res = await run(FULL_COLS)
  // The chat-features SQL has not been run yet: fall back to the old columns.
  if (res.error && res.error.code === '42703') res = await run(BASE_COLS)
  const items = check(res) as unknown as Message[]
  return { items, nextCursor: items.length === MESSAGE_PAGE ? items[items.length - 1].created_at : null }
}

export async function sendMessage(chatId: string, content: string, forwarded = false): Promise<Message> {
  const text = content.trim()
  if (!text) throw new Error('Type a message first.')
  if (text.length > MAX_MESSAGE_LENGTH) throw new Error(`Messages can be up to ${MAX_MESSAGE_LENGTH} characters.`)
  const row = forwarded ? { chat_id: chatId, content: text, forwarded: true } : { chat_id: chatId, content: text }
  const res = await supabase.from('messages').insert(row).select(BASE_COLS).single()
  return check(res) as unknown as Message
}

export async function markChatRead(chatId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_chat_read', { p_chat: chatId })
  if (error) throw new Error(error.message)
}

/** Unsend for everyone (2 minutes). Falls back to a plain delete if the chat-features SQL has not been run. */
export async function deleteMessage(id: string): Promise<void> {
  const { error } = await supabase.rpc('unsend_message', { p_id: id })
  if (!error) return
  if (error.code === 'PGRST202' || error.code === '42883') {
    const del = await supabase.from('messages').delete().eq('id', id)
    if (del.error) throw new Error(del.error.message)
    return
  }
  throw new Error(error.message)
}

export async function editMessage(id: string, content: string): Promise<void> {
  const text = content.trim()
  if (!text) throw new Error('Type a message first.')
  const { error } = await supabase.rpc('edit_message', { p_id: id, p_content: text })
  if (error) throw new Error(error.message)
}

/** Pass null to remove your reaction. */
export async function reactToMessage(messageId: string, emoji: string | null): Promise<void> {
  const { error } = await supabase.rpc('react_message', { p_message: messageId, p_emoji: emoji })
  if (error) throw new Error(error.message)
}

export async function fetchReactions(messageIds: string[]): Promise<MessageReaction[]> {
  if (!messageIds.length) return []
  const { data, error } = await supabase.from('message_reactions').select('message_id, user_id, emoji').in('message_id', messageIds)
  return error || !data ? [] : (data as MessageReaction[])
}

/** Reaction changes for messages I can see (RLS). `removed` carries only the ids. */
export function subscribeReactions(onSet: (r: MessageReaction) => void, onRemove: (messageId: string, userId: string) => void): () => void {
  const channel = supabase
    .channel(channelName('reactions'))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, (payload) => {
      if (payload.eventType === 'DELETE') {
        const o = payload.old as Partial<MessageReaction>
        if (o.message_id && o.user_id) onRemove(o.message_id, o.user_id)
      } else {
        onSet(payload.new as MessageReaction)
      }
    })
    .subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}

/** New messages in one conversation. RLS ensures only members receive events. */
export function subscribeChat(
  chatId: string,
  onMessage: (m: Message) => void,
  onStatus?: (status: string) => void,
  extra?: { onUpdate?: (m: Message) => void; onDelete?: (id: string) => void },
): () => void {
  const channel = supabase
    .channel(channelName(`chat:${chatId}`))
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, (payload) => onMessage(payload.new as Message))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` }, (payload) => extra?.onUpdate?.(payload.new as Message))
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
      const id = (payload.old as { id?: string }).id
      if (id) extra?.onDelete?.(id)
    })
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

/** Chat ids that are message requests for me. Returns [] when the SQL has not been run yet. */
export async function listMessageRequestIds(): Promise<string[]> {
  const { data, error } = await supabase.rpc('my_message_requests')
  if (error || !Array.isArray(data)) return []
  return data.map((x: unknown) => String(x))
}
