import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { appUrl } from '@/lib/base'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, errorMessage } from '@/lib/supabase'
import { loadOrCreateMyProfile } from '@/services/profiles'
import type { Profile } from '@/types/db'

interface SignUpInput {
  email: string
  password: string
  username: string
  displayName: string
}

interface AuthApi {
  session: Session | null
  user: User | null
  profile: Profile | null
  /** True until the stored session has been restored and the profile loaded. */
  loading: boolean
  profileError: string | null
  recovering: boolean
  signUp: (input: SignUpInput) => Promise<{ needsEmailConfirmation: boolean }>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  resendVerification: (email: string) => Promise<void>
  retryProfile: () => void
  setProfile: (p: Profile) => void
}

const AuthContext = createContext<AuthApi | null>(null)

const callbackUrl = () => appUrl('/auth/callback')

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [recovering, setRecovering] = useState(false)
  const [retryTick, setRetryTick] = useState(0)

  // Restore the persisted session on first load and follow auth changes.
  useEffect(() => {
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setInitializing(false)
    }).catch(() => active && setInitializing(false))

    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      // Keep this callback synchronous: calling other Supabase methods inside it can deadlock.
      setSession(next)
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (event === 'SIGNED_OUT') {
        setProfile(null)
        setRecovering(false)
      }
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const userId = session?.user.id ?? null

  // Load (or safely create) the profile whenever the signed-in user changes.
  useEffect(() => {
    if (!userId) {
      setProfile(null)
      setProfileError(null)
      return
    }
    let cancelled = false
    setProfileError(null)
    loadOrCreateMyProfile(userId)
      .then((p) => !cancelled && setProfile(p))
      .catch((e) => !cancelled && setProfileError(errorMessage(e, 'Could not load your profile.')))
    return () => {
      cancelled = true
    }
  }, [userId, retryTick])

  const signUp = useCallback<AuthApi['signUp']>(async ({ email, password, username, displayName }) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: callbackUrl(),
        // Read by the database trigger that creates the profile. Never used for authorization.
        data: { username, display_name: displayName.trim() || username },
      },
    })
    if (error) throw new Error(error.message)
    return { needsEmailConfirmation: !data.session }
  }, [])

  const signIn = useCallback<AuthApi['signIn']>(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw new Error(error.message)
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const requestPasswordReset = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: callbackUrl() })
    if (error) throw new Error(error.message)
  }, [])

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (error) throw new Error(error.message)
    setRecovering(false)
  }, [])

  const resendVerification = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: callbackUrl() } })
    if (error) throw new Error(error.message)
  }, [])

  const retryProfile = useCallback(() => setRetryTick((t) => t + 1), [])

  const value = useMemo<AuthApi>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading: initializing || (!!userId && !profile && !profileError),
      profileError,
      recovering,
      signUp,
      signIn,
      signOut,
      requestPasswordReset,
      updatePassword,
      resendVerification,
      retryProfile,
      setProfile,
    }),
    [session, profile, initializing, userId, profileError, recovering, signUp, signIn, signOut, requestPasswordReset, updatePassword, resendVerification, retryProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** For screens that only render when signed in: returns the non-null profile. */
export function useMe(): Profile {
  const { profile } = useAuth()
  if (!profile) throw new Error('useMe called without a loaded profile')
  return profile
}
