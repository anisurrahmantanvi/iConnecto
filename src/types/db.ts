export interface Profile {
  id: string
  username: string
  display_name: string | null
  bio: string | null
  avatar_url: string | null
  cover_url: string | null
  followers_count: number
  following_count: number
  posts_count: number
  created_at: string
}

export type ProfileLite = Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'>

export interface Post {
  id: string
  author_id: string
  content: string
  media_urls: string[]
  community_id: string | null
  like_count: number
  comment_count: number
  share_count: number
  created_at: string
  updated_at: string
  /** Set by the server only when the text itself was changed (updated_at also moves for counter updates). */
  edited_at: string | null
  author: ProfileLite | null
  community: { slug: string; name: string } | null
}

export interface PostView extends Post {
  liked: boolean
  saved: boolean
  reactions: ReactionSummary[]
}

export interface ReactionSummary {
  emoji: string
  count: number
  reacted: boolean
}

export interface Comment {
  id: string
  post_id: string
  author_id: string
  parent_id: string | null
  content: string
  like_count: number
  reply_count: number
  created_at: string
  updated_at: string
  edited_at: string | null
  author: ProfileLite | null
}

export interface CommentView extends Comment {
  liked: boolean
}

export type NotificationType = 'follow' | 'like' | 'comment' | 'reply' | 'community_join'

export interface AppNotification {
  id: string
  recipient_id: string
  actor_id: string | null
  type: NotificationType
  post_id: string | null
  comment_id: string | null
  community_id: string | null
  is_read: boolean
  created_at: string
  actor: ProfileLite | null
}

export interface ChatSummary {
  chat_id: string
  other_id: string
  other_username: string
  other_display_name: string | null
  other_avatar_url: string | null
  last_message_at: string | null
  last_message_preview: string | null
  unread_count: number
}

export interface Message {
  id: string
  chat_id: string
  sender_id: string
  content: string
  created_at: string
}

export interface Community {
  id: string
  name: string
  slug: string
  description: string | null
  avatar_url: string | null
  is_private: boolean
  owner_id: string
  member_count: number
  created_at: string
}

export type CommunityRole = 'owner' | 'moderator' | 'member'

export interface CommunityMember {
  community_id: string
  user_id: string
  role: CommunityRole
  joined_at: string
  profile: ProfileLite | null
}

export type CallType = 'audio' | 'video'
export type CallStatus = 'ringing' | 'accepted' | 'declined' | 'cancelled' | 'missed' | 'ended' | 'failed'

export interface CallSession {
  id: string
  caller_id: string
  callee_id: string
  call_type: CallType
  status: CallStatus
  created_at: string
  started_at: string | null
  ended_at: string | null
}

export type ReportTarget = 'user' | 'post' | 'comment' | 'community'
export type ReportReason =
  | 'spam' | 'harassment' | 'hate' | 'violence' | 'nudity' | 'self_harm' | 'impersonation' | 'other'

export interface Page<T> {
  items: T[]
  nextCursor: string | null
}
