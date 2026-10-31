import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AuthProvider } from './AuthProvider'
import { BadgesProvider } from './BadgesProvider'
import { ConfigGate, ProtectedRoute, PublicOnlyRoute, Splash } from './guards'
import { AppShell } from '@/components/layout/AppShell'

// Every screen is its own chunk so the first load stays small on slow mobile connections.
const LoginPage = lazy(() => import('@/pages/auth/Login'))
const SignupPage = lazy(() => import('@/pages/auth/Signup'))
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPassword'))
const AuthCallbackPage = lazy(() => import('@/pages/auth/AuthCallback'))
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPassword'))
const OnboardingPage = lazy(() => import('@/pages/auth/Onboarding'))

const HomePage = lazy(() => import('@/pages/Home'))
const DiscoverPage = lazy(() => import('@/pages/Discover'))
const CreatePage = lazy(() => import('@/pages/Create'))
const PostDetailPage = lazy(() => import('@/pages/PostDetail'))
const ProfilePage = lazy(() => import('@/pages/Profile'))
const FollowListPage = lazy(() => import('@/pages/FollowList'))
const SavedPage = lazy(() => import('@/pages/Saved'))
const NotificationsPage = lazy(() => import('@/pages/Notifications'))
const InboxPage = lazy(() => import('@/pages/Inbox'))
const ChatPage = lazy(() => import('@/pages/Chat'))
const CommunitiesPage = lazy(() => import('@/pages/Communities'))
const CommunityDetailPage = lazy(() => import('@/pages/CommunityDetail'))
const CommunityFormPage = lazy(() => import('@/pages/CommunityForm'))
const CallPage = lazy(() => import('@/pages/Call'))
const ReportPage = lazy(() => import('@/pages/Report'))
const NotFoundPage = lazy(() => import('@/pages/NotFound'))

const ReelsPage = lazy(() => import('@/pages/Reels'))
const MessageSettingsPage = lazy(() => import('@/pages/MessageSettings'))
const SettingsHomePage = lazy(() => import('@/pages/settings/SettingsHome'))
const EditProfilePage = lazy(() => import('@/pages/settings/EditProfile'))
const PrivacyPage = lazy(() => import('@/pages/settings/Privacy'))
const BlockedPage = lazy(() => import('@/pages/settings/Blocked'))
const AccountPage = lazy(() => import('@/pages/settings/Account'))

/** Signed-in layout plus the shared realtime badge counters (one subscription for the whole session). */
function SignedInLayout() {
  return (
    <BadgesProvider>
      <AppShell />
    </BadgesProvider>
  )
}

export function App() {
  return (
    <ConfigGate>
      <AuthProvider>
        <Suspense fallback={<Splash />}>
          <Routes>
            {/* Signed-out only */}
            <Route element={<PublicOnlyRoute />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            </Route>

            {/* Email links: must work whatever the auth state is */}
            <Route path="/auth/callback" element={<AuthCallbackPage />} />
            <Route path="/auth/reset" element={<ResetPasswordPage />} />

            {/* Signed-in only */}
            <Route element={<ProtectedRoute />}>
              <Route path="/onboarding" element={<OnboardingPage />} />

              <Route element={<SignedInLayout />}>
                <Route index element={<HomePage />} />
                <Route path="/discover" element={<DiscoverPage />} />
                <Route path="/create" element={<CreatePage />} />
                <Route path="/p/:postId" element={<PostDetailPage />} />
                <Route path="/saved" element={<SavedPage />} />
                <Route path="/notifications" element={<NotificationsPage />} />

                <Route path="/u/:username" element={<ProfilePage />} />
                <Route path="/u/:username/followers" element={<FollowListPage kind="followers" />} />
                <Route path="/u/:username/following" element={<FollowListPage kind="following" />} />

                <Route path="/messages" element={<InboxPage />} />
                <Route path="/message-settings" element={<MessageSettingsPage />} />
                <Route path="/messages/:chatId" element={<ChatPage />} />

                <Route path="/reels" element={<ReelsPage />} />
                <Route path="/communities" element={<CommunitiesPage />} />
                <Route path="/communities/new" element={<CommunityFormPage mode="create" />} />
                <Route path="/c/:slug" element={<CommunityDetailPage />} />
                <Route path="/c/:slug/edit" element={<CommunityFormPage mode="edit" />} />

                <Route path="/call/:callId" element={<CallPage />} />
                <Route path="/report/:targetType/:targetId" element={<ReportPage />} />

                <Route path="/settings" element={<SettingsHomePage />} />
                <Route path="/settings/profile" element={<EditProfilePage />} />
                <Route path="/settings/privacy" element={<PrivacyPage />} />
                <Route path="/settings/blocked" element={<BlockedPage />} />
                <Route path="/settings/account" element={<AccountPage />} />

                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </ConfigGate>
  )
}
