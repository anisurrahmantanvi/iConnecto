import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { ShieldAlert } from 'lucide-react'
import { useAuth } from './AuthProvider'
import { Button } from '@/components/ui/Button'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { Logo } from '@/components/ui/Logo'
import { env, missingEnv, unsafeKey } from '@/lib/env'

export function Splash({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="splash" role="status" aria-live="polite">
      <div className="col center" style={{ alignItems: 'center', gap: 16 }}>
        <Logo size={88} decorative className="logo--pulse" />
        <strong style={{ letterSpacing: '-0.02em', fontSize: 20 }}>iConnecto</strong>
        <span className="sr-only">{label}</span>
      </div>
    </div>
  )
}

/** Shown instead of the app when required configuration is missing, with exact instructions. */
export function ConfigGate({ children }: { children: React.ReactNode }) {
  if (unsafeKey) {
    return (
      <div className="auth">
        <GlassPanel className="auth__card" role="alert">
          <ShieldAlert size={32} color="var(--danger)" aria-hidden />
          <h1>Unsafe key detected</h1>
          <p className="muted">
            VITE_SUPABASE_PUBLISHABLE_KEY looks like a service-role / secret key. Anything starting with VITE_ is shipped to every
            visitor's browser. Replace it with the project's <strong>publishable (anon)</strong> key, rotate the leaked key in the
            Supabase dashboard, then restart the dev server.
          </p>
        </GlassPanel>
      </div>
    )
  }
  if (missingEnv.length) {
    return (
      <div className="auth">
        <GlassPanel className="auth__card" role="alert">
          <ShieldAlert size={32} color="var(--accent)" aria-hidden />
          <h1>Finish setup</h1>
          <p className="muted">iConnecto needs your Supabase project settings before it can start.</p>
          <ol className="small" style={{ paddingLeft: 18, margin: 0 }}>
            <li>Copy <code>.env.example</code> to <code>.env</code></li>
            <li>Fill in: <code>{missingEnv.join(', ')}</code></li>
            <li>Restart <code>npm run dev</code></li>
          </ol>
          <p className="small faint">Find them in Supabase → Project Settings → API. Use the publishable key, never the service-role key.</p>
        </GlassPanel>
      </div>
    )
  }
  void env
  return <>{children}</>
}

/** Redirects to /login when signed out; waits for session restore so a refresh does not flash the login page. */
export function ProtectedRoute() {
  const { session, loading, profileError, retryProfile, signOut } = useAuth()
  const location = useLocation()

  if (loading) return <Splash />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (profileError) {
    return (
      <div className="auth">
        <GlassPanel className="auth__card" role="alert">
          <h1>We couldn't load your profile</h1>
          <p className="muted">{profileError}</p>
          <Button variant="primary" onClick={retryProfile}>Try again</Button>
          <Button variant="ghost" onClick={() => void signOut()}>Sign out</Button>
        </GlassPanel>
      </div>
    )
  }
  return <Outlet />
}

/** Login / signup pages bounce signed-in users to the app. */
export function PublicOnlyRoute() {
  const { session, loading } = useAuth()
  const location = useLocation()
  if (loading) return <Splash />
  if (session) {
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from && from.startsWith('/') ? from : '/'} replace />
  }
  return <Outlet />
}
