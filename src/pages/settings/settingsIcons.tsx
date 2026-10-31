import type { ComponentType } from 'react'
import {
  Accessibility, Activity, BadgeCheck, Baby, BarChart3, Bell, Brain, Brush, Clock, Crown, Eye, Film, Filter, Fingerprint, Globe,
  Heart, HelpCircle, Image, KeyRound, Languages, LifeBuoy, Lock, Mail, MessageCircle, MessageSquare, Moon, Palette, Settings,
  Shield, ShieldAlert, ShieldCheck, Smartphone, Sparkles, Star, Timer, User, UserCog, UserPlus, Users, Wallet,
} from 'lucide-react'

type Icon = ComponentType<{ size?: number; className?: string; 'aria-hidden'?: boolean }>

/** One icon per group and per section on the Settings screen. */
export const SETTINGS_ICONS: Record<string, Icon> = {
  // groups
  Account: User,
  Privacy: Lock,
  Security: ShieldCheck,
  'Notifications & Wellbeing': Bell,
  'Feed, Reels & Media': Film,
  'Appearance & Language': Palette,
  'Creator & Premium': Crown,
  'Help & Legal': HelpCircle,
  // sections
  Settings: Settings,
  Preferences: Languages,
  'Audience & Visibility': Eye,
  Activity: Activity,
  Themes: Palette,
  'Security & Privacy': Shield,
  Notifications: Bell,
  'Add Account & Logout': UserPlus,
  'Privacy Center': ShieldCheck,
  'Login & Devices': Smartphone,
  'Messaging Settings': MessageCircle,
  'Interaction Settings': MessageSquare,
  'Feed Preferences': Heart,
  'Reels Settings': Film,
  'Creator Tools': BarChart3,
  'Your Information': UserCog,
  Accessibility: Accessibility,
  'Support & Feedback': LifeBuoy,
  'Verified Badge': BadgeCheck,
  'Close Friends': Star,
  'Quiet Mode': Moon,
  'Hidden Words': Filter,
  'Parental Controls': Baby,
  'AI Content Recommendations': Brain,
  'Account Memorialization': Globe,
  'Premium Subscription': Crown,
  'Profile Customization': Brush,
  'Advanced Media Controls': Image,
  'Creator Monetization': Wallet,
  'Advanced Chat Features': MessageCircle,
  'Digital Wellbeing': Timer,
  'Content Safety': ShieldAlert,
  'Advanced Account Protection': Fingerprint,
  Clock: Clock,
  Key: KeyRound,
  Spark: Sparkles,
  Users: Users,
}
