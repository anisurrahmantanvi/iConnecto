/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_EMOJI_BASE_URL?: string
  readonly VITE_ICE_SERVERS?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
