/**
 * The Settings menu, one place to release things one by one.
 * An item with a `to` route opens that screen. An item without one shows "Coming soon" when tapped.
 * To release an item, give it a `to`.
 * `inline` sections also show a ready-made control at the top (language, themes, push notifications).
 */
export interface SettingsItem {
  title: string
  to?: string
}
export interface SettingsSection {
  title: string
  inline?: 'language' | 'themes' | 'push'
  items: SettingsItem[]
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    title: 'Settings',
    items: [
      { title: 'Account Center', to: '/settings/account' },
      { title: 'Audience Settings' },
    ],
  },
  {
    title: 'Preferences',
    inline: 'language',
    items: [
      { title: 'Media: Data Saver ON/OFF' },
    ],
  },
  {
    title: 'Audience & Visibility',
    items: [
      { title: 'Profile Lock' },
      { title: 'Profile Details', to: '/settings/profile' },
      { title: 'How People Find and Contact You' },
      { title: 'Posts' },
      { title: 'Stories' },
      { title: 'Profile and Tagging' },
      { title: 'Active Status', to: '/settings/privacy' },
      { title: 'Privacy Options: Public, Friends, Followers, Only Me' },
    ],
  },
  {
    title: 'Activity',
    items: [
      { title: 'Activity Log' },
      { title: 'Your Posts' },
      { title: 'Comments and Reactions' },
      { title: 'Search History' },
      { title: 'Recently Deleted' },
    ],
  },
  {
    title: 'Themes',
    inline: 'themes',
    items: [
    ],
  },
  {
    title: 'Security & Privacy',
    items: [
      { title: 'Change Password', to: '/settings/privacy' },
      { title: 'Two-Factor Authentication' },
      { title: 'Login Activity', to: '/settings/privacy' },
      { title: 'Blocked Accounts', to: '/settings/blocked' },
      { title: 'Restricted Accounts' },
    ],
  },
  {
    title: 'Notifications',
    inline: 'push',
    items: [
      { title: 'In-App Notifications' },
      { title: 'Email Notifications' },
      { title: 'Notification Sounds' },
      { title: 'Notification Preferences' },
    ],
  },
  {
    title: 'Help & Legal',
    items: [
      { title: 'Help Center' },
      { title: 'Report a Problem' },
      { title: 'Terms of Service' },
      { title: 'Privacy Policy' },
      { title: 'About iConnecto' },
    ],
  },
  {
    title: 'Add Account & Logout',
    items: [
      { title: 'Add Another Existing Account' },
      { title: 'Switch Between Accounts' },
      { title: 'Secure Session Management' },
    ],
  },
  {
    title: 'Privacy Center',
    items: [
      { title: 'Privacy Checkup' },
      { title: 'Profile Visibility', to: '/settings/privacy' },
      { title: 'Private Account' },
      { title: 'Blocked Users', to: '/settings/blocked' },
      { title: 'Restricted Users' },
      { title: 'Who Can See My Content' },
      { title: 'Manage Personal Information' },
    ],
  },
  {
    title: 'Login & Devices',
    items: [
      { title: 'Logged-in Devices', to: '/settings/privacy' },
      { title: 'Device History' },
      { title: 'Logout From All Devices' },
      { title: 'Suspicious Login Alerts' },
      { title: 'Login Notifications' },
      { title: 'Manage Active Sessions' },
    ],
  },
  {
    title: 'Messaging Settings',
    items: [
      { title: 'Message Requests' },
      { title: 'Read Receipts ON/OFF' },
      { title: 'Typing Status ON/OFF' },
      { title: 'Online Status ON/OFF' },
      { title: 'Who Can Message You' },
      { title: 'Group Invitation Settings' },
      { title: 'Media Auto-Download' },
    ],
  },
  {
    title: 'Interaction Settings',
    items: [
      { title: 'Who Can Comment' },
      { title: 'Who Can Mention You' },
      { title: 'Who Can Tag You' },
      { title: 'Who Can React to Posts' },
      { title: 'Who Can Share Your Posts' },
      { title: 'Manual Tag Approval' },
    ],
  },
  {
    title: 'Feed Preferences',
    items: [
      { title: 'Favorites' },
      { title: 'Unfollow Accounts' },
      { title: 'Snooze Accounts' },
      { title: 'Hidden Posts' },
      { title: 'Content Recommendations' },
      { title: 'Manage Interests' },
      { title: 'Show Less / Show More Content' },
    ],
  },
  {
    title: 'Reels Settings',
    items: [
      { title: 'Autoplay ON/OFF' },
      { title: 'Video Quality' },
      { title: 'Upload Quality' },
      { title: 'Captions ON/OFF' },
      { title: 'Data Usage' },
      { title: 'Reels Preferences' },
      { title: 'Allow Remixing' },
      { title: 'Allow Reel Sharing' },
    ],
  },
  {
    title: 'Creator Tools',
    items: [
      { title: 'Professional Dashboard' },
      { title: 'Creator Insights' },
      { title: 'Audience Analytics' },
      { title: 'Creator Profile' },
      { title: 'Monetization (when available)' },
      { title: 'Content Performance' },
      { title: 'Follower Growth' },
      { title: 'Earnings Dashboard (when available)' },
    ],
  },
  {
    title: 'Your Information',
    items: [
      { title: 'Download Your Information' },
      { title: 'Export Account Data' },
      { title: 'Account Deactivation' },
      { title: 'Account Deletion', to: '/settings/account' },
      { title: 'Data Management' },
      { title: 'Manage Uploaded Media' },
    ],
  },
  {
    title: 'Accessibility',
    items: [
      { title: 'Font Size' },
      { title: 'Reduced Motion' },
      { title: 'Screen Reader Support' },
      { title: 'Video Captions' },
      { title: 'Accessibility Preferences' },
      { title: 'High Contrast Mode' },
    ],
  },
  {
    title: 'Support & Feedback',
    items: [
      { title: 'Contact Support' },
      { title: 'Report a Bug' },
      { title: 'Request a Feature' },
      { title: 'Report Status' },
      { title: 'Frequently Asked Questions' },
      { title: 'Help Center' },
      { title: 'Community Guidelines' },
    ],
  },
  {
    title: 'Verified Badge',
    items: [
      { title: 'Identity Verification' },
      { title: 'Verified Profile Badge' },
      { title: 'Verification Status' },
      { title: 'Verification Renewal' },
      { title: 'Verification Support' },
    ],
  },
  {
    title: 'Close Friends',
    items: [
      { title: 'Create Close Friends List' },
      { title: 'Add or Remove Friends' },
      { title: 'Share Stories with Close Friends' },
      { title: 'Manage Close Friends Visibility' },
    ],
  },
  {
    title: 'Quiet Mode',
    items: [
      { title: 'Enable / Disable Quiet Mode' },
      { title: 'Custom Start and End Time' },
      { title: 'Pause Notifications' },
      { title: 'Automatic Quiet Mode Schedule' },
    ],
  },
  {
    title: 'Hidden Words',
    items: [
      { title: 'Filter Offensive Words' },
      { title: 'Custom Hidden Words' },
      { title: 'Comment Filtering' },
      { title: 'Message Request Filtering' },
      { title: 'Spam Keyword Filtering' },
    ],
  },
  {
    title: 'Parental Controls',
    items: [
      { title: 'Parental Supervision' },
      { title: 'Screen Time Information' },
      { title: 'Privacy Guidance' },
      { title: 'Restricted Content Settings' },
      { title: 'Supervision Management' },
    ],
  },
  {
    title: 'AI Content Recommendations',
    items: [
      { title: 'Personalized Feed' },
      { title: 'Recommended Reels' },
      { title: 'Interest-Based Content' },
      { title: 'Manage Recommendation Topics' },
      { title: 'Reset Recommendations' },
      { title: 'Not Interested Option' },
    ],
  },
  {
    title: 'Account Memorialization',
    items: [
      { title: 'Memorialization Request' },
      { title: 'Memorialized Account Information' },
      { title: 'Legacy Contact' },
      { title: 'Account Memorialization Policy' },
    ],
  },
  {
    title: 'Premium Subscription',
    items: [
      { title: 'iConnecto Premium' },
      { title: 'Subscription Plans' },
      { title: 'Premium Benefits' },
      { title: 'Subscription Management' },
      { title: 'Payment History' },
      { title: 'Cancel Subscription' },
      { title: 'Restore Purchase' },
    ],
  },
  {
    title: 'Profile Customization',
    items: [
      { title: 'Profile Themes' },
      { title: 'Custom Profile Background' },
      { title: 'Profile Accent Colors' },
      { title: 'Custom Profile Layout' },
      { title: 'Profile Music' },
      { title: 'Profile Display Preferences' },
    ],
  },
  {
    title: 'Advanced Media Controls',
    items: [
      { title: 'HD Photo Upload' },
      { title: 'HD Video Upload' },
      { title: 'Original Quality Upload' },
      { title: 'Automatic Video Compression' },
      { title: 'Media Storage Management' },
      { title: 'Upload Preferences' },
    ],
  },
  {
    title: 'Creator Monetization',
    items: [
      { title: 'Creator Eligibility' },
      { title: 'Monetization Status' },
      { title: 'Creator Earnings' },
      { title: 'Payment Information' },
      { title: 'Payout History' },
      { title: 'Monetization Policy' },
    ],
  },
  {
    title: 'Advanced Chat Features',
    items: [
      { title: 'Chat Themes' },
      { title: 'Custom Chat Wallpaper' },
      { title: 'Disappearing Messages' },
      { title: 'Message Privacy' },
      { title: 'Chat Backup' },
      { title: 'Manage Archived Chats' },
    ],
  },
  {
    title: 'Digital Wellbeing',
    items: [
      { title: 'Daily Usage Information' },
      { title: 'Screen Time Reminder' },
      { title: 'Break Reminders' },
      { title: 'Quiet Hours' },
      { title: 'Notification Summary' },
    ],
  },
  {
    title: 'Content Safety',
    items: [
      { title: 'Sensitive Content Controls' },
      { title: 'Spam Protection' },
      { title: 'Offensive Content Filtering' },
      { title: 'Reported Content History' },
      { title: 'Community Safety Preferences' },
    ],
  },
  {
    title: 'Advanced Account Protection',
    items: [
      { title: 'Passkeys' },
      { title: 'Two-Factor Authentication' },
      { title: 'Trusted Devices' },
      { title: 'Security Alerts' },
      { title: 'Recovery Email and Phone' },
      { title: 'Account Recovery' },
    ],
  },
]

/** Top-level groups shown on the Settings screen. Each lists the sections above that live inside it. */
export const SETTINGS_GROUPS: { title: string; caption: string; sections: string[] }[] = [
  { title: 'Account', caption: 'Your account, profile, data and sign-in.', sections: ['Settings', 'Your Information', 'Verified Badge', 'Account Memorialization', 'Add Account & Logout'] },
  { title: 'Privacy', caption: 'Control who can see and do things with your content.', sections: ['Audience & Visibility', 'Privacy Center', 'Interaction Settings', 'Close Friends', 'Hidden Words', 'Content Safety', 'Parental Controls'] },
  { title: 'Security', caption: 'Passwords, devices and ways to protect your account.', sections: ['Security & Privacy', 'Login & Devices', 'Advanced Account Protection'] },
  { title: 'Notifications & Wellbeing', caption: 'Alerts, quiet time and healthy use.', sections: ['Notifications', 'Quiet Mode', 'Digital Wellbeing'] },
  { title: 'Feed, Reels & Media', caption: 'Customize what you see and how media loads.', sections: ['Feed Preferences', 'AI Content Recommendations', 'Activity', 'Reels Settings', 'Advanced Media Controls'] },
  { title: 'Appearance & Language', caption: 'Language, theme and how the app looks.', sections: ['Preferences', 'Themes', 'Accessibility', 'Profile Customization'] },
  { title: 'Help & Legal', caption: 'Get help, send feedback and read our policies.', sections: ['Help & Legal', 'Support & Feedback'] },
]

/** URL-friendly name of a section, used in /settings/section/:slug. */
export const sectionSlug = (title: string): string => title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
