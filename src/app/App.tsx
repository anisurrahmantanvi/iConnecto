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
const ReelPlayerPage = lazy(() => import('@/pages/Reels').then((m) => ({ default: m.ReelPlayerPage })))
const ReelCreatePage = lazy(() => import('@/pages/reels/ReelCreate'))
const MessageSettingsPage = lazy(() => import('@/pages/MessageSettings'))
const SettingsSectionPage = lazy(() => import('@/pages/settings/SettingsSection'))
const MenuPage = lazy(() => import('@/pages/Menu'))
const PrivacyPolicyPage = lazy(() => import('@/pages/PrivacyPolicy'))
const FriendRequestsPage = lazy(() => import('@/pages/FriendRequests'))
const SettingsHomePage = lazy(() => import('@/pages/settings/SettingsHome'))
const MessagePrivacyPage = lazy(() => import('@/pages/MessagePrivacy'))
const ChatLookPage = lazy(() => import('@/pages/ChatLook'))
const ArchivedChatsPage = lazy(() => import('@/pages/ArchivedChats'))
const EditProfilePage = lazy(() => import('@/pages/settings/EditProfile'))
const PagesHomePage = lazy(() => import('@/pages/pages/PagesHome'))
const PageViewPage = lazy(() => import('@/pages/pages/PageView'))
const PageFormPage = lazy(() => import('@/pages/pages/PageForm'))
const FeedbackPage = lazy(() => import('@/pages/settings/Feedback'))
const SupportStatusPage = lazy(() => import('@/pages/settings/SupportStatus'))
const HelpCenterPage = lazy(() => import('@/pages/settings/HelpCenter'))
const AboutPage = lazy(() => import('@/pages/settings/About'))
const TermsPage = lazy(() => import('@/pages/Terms'))
const NotificationPrefsPage = lazy(() => import('@/pages/settings/NotificationPrefs'))
const YourDataPage = lazy(() => import('@/pages/settings/YourData'))
const DeactivatePage = lazy(() => import('@/pages/settings/Deactivate'))
const MyMediaPage = lazy(() => import('@/pages/settings/MyMedia'))
const CopyTextPage = lazy(() => import('@/pages/settings/CopyText'))
const ActivityLogPage = lazy(() => import('@/pages/settings/ActivityLog'))
const PageNotificationsPage = lazy(() => import('@/pages/pages/PageNotifications'))
const DisplayPrefsPage = lazy(() => import('@/pages/settings/DisplayPrefsPage'))
const MarketHomePage = lazy(() => import('@/pages/market/MarketHome'))
const TwoFactorPage = lazy(() => import('@/pages/settings/TwoFactor'))
const TrustedDevicesPage = lazy(() => import('@/pages/settings/TrustedDevices'))
const SecurityAlertsPage = lazy(() => import('@/pages/settings/SecurityAlerts'))
const ChangeEmailPage = lazy(() => import('@/pages/settings/ChangeEmail'))
const ChangePasswordPage = lazy(() => import('@/pages/settings/ChangePassword'))
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

            {/* Public pages */}
            <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsPage />} />

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
                <Route path="/friend-requests" element={<FriendRequestsPage />} />
                <Route path="/follow-requests" element={<FriendRequestsPage />} />

                <Route path="/u/:username" element={<ProfilePage />} />
                <Route path="/u/:username/followers" element={<FollowListPage />} />
                <Route path="/u/:username/following" element={<FollowListPage />} />
                <Route path="/u/:username/friends" element={<FollowListPage />} />

                <Route path="/messages" element={<InboxPage />} />
                <Route path="/message-settings" element={<MessageSettingsPage />} />
                <Route path="/message-settings/privacy" element={<MessagePrivacyPage />} />
                <Route path="/message-settings/themes" element={<ChatLookPage mode="theme" />} />
                <Route path="/message-settings/wallpaper" element={<ChatLookPage mode="wallpaper" />} />
                <Route path="/message-settings/archived" element={<ArchivedChatsPage />} />
                <Route path="/messages/:chatId" element={<ChatPage />} />

                <Route path="/reels" element={<ReelsPage />} />
                <Route path="/reels/new" element={<ReelCreatePage />} />
                <Route path="/reels/:id" element={<ReelPlayerPage />} />
                <Route path="/communities" element={<CommunitiesPage />} />
                <Route path="/communities/new" element={<CommunityFormPage mode="create" />} />
                <Route path="/c/:slug" element={<CommunityDetailPage />} />
                <Route path="/c/:slug/edit" element={<CommunityFormPage mode="edit" />} />

                <Route path="/call/:callId" element={<CallPage />} />
                <Route path="/report/:targetType/:targetId" element={<ReportPage />} />

                <Route path="/menu" element={<MenuPage />} />
                <Route path="/pages" element={<PagesHomePage />} />
                <Route path="/pages/new" element={<PageFormPage mode="create" />} />
                <Route path="/page/:slug" element={<PageViewPage />} />
                <Route path="/page/:slug/notifications" element={<PageNotificationsPage />} />
                <Route path="/page/:slug/edit" element={<PageFormPage mode="edit" />} />
                <Route path="/settings/notification-prefs" element={<NotificationPrefsPage />} />
                <Route path="/settings/your-data" element={<YourDataPage />} />
                <Route path="/settings/deactivate" element={<DeactivatePage />} />
                <Route path="/settings/media" element={<MyMediaPage />} />
                <Route path="/settings/copy-text" element={<CopyTextPage />} />
                <Route path="/settings/activity" element={<ActivityLogPage />} />
                <Route path="/settings/display" element={<DisplayPrefsPage />} />
                <Route path="/settings/help" element={<HelpCenterPage />} />
                <Route path="/settings/about" element={<AboutPage />} />
                <Route path="/settings/support/status" element={<SupportStatusPage />} />
                <Route path="/settings/support/problem" element={<FeedbackPage kind="problem" />} />
                <Route path="/settings/support/bug" element={<FeedbackPage kind="bug" />} />
                <Route path="/settings/support/feature" element={<FeedbackPage kind="feature" />} />
                <Route path="/settings/support/contact" element={<FeedbackPage kind="support" />} />
                <Route path="/market" element={<MarketHomePage />} />
                <Route path="/settings" element={<SettingsHomePage />} />
                <Route path="/settings/section/:slug" element={<SettingsSectionPage />} />
                <Route path="/settings/profile" element={<EditProfilePage />} />
                <Route path="/settings/privacy" element={<PrivacyPage />} />
                <Route path="/settings/two-factor" element={<TwoFactorPage />} />
                <Route path="/settings/devices" element={<TrustedDevicesPage />} />
                <Route path="/settings/security-alerts" element={<SecurityAlertsPage />} />
                <Route path="/settings/change-email" element={<ChangeEmailPage />} />
                <Route path="/settings/change-password" element={<ChangePasswordPage />} />
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
