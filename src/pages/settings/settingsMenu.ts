/**
 * The Settings menu, one place to release things one by one.
 * An item with a `to` route opens that screen. An item without one shows "Coming soon" when tapped.
 * To release an item, give it a `to`.
 */
export interface SettingsItem {
  title: string
  to?: string
}
export interface SettingsSection {
  title: string
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
    title: 'Audience & Visibility',
    items: [
      { title: 'Profile Lock' },
      { title: 'Profile Details', to: '/settings/profile' },
      { title: 'How People Find and Contact You' },
      { title: 'Posts' },
      { title: 'Stories' },
      { title: 'Profile and Tagging' },
      { title: 'Active Status', to: '/settings/privacy' },
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
    title: 'Help & Legal',
    items: [
      { title: 'Help Center' },
      { title: 'Report a Problem' },
      { title: 'Terms of Service' },
      { title: 'Privacy Policy' },
      { title: 'About iConnecto' },
    ],
  },
]
