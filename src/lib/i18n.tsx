import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

/**
 * Minimal localisation layer. English is the source language; Bengali ("bn") is provided for navigation,
 * sign-in/sign-up, home and settings. Any key without a translation falls back to English, so adding a language
 * (or more Bengali strings) never breaks a screen. To translate more of the app, add keys to `en` and `bn` and
 * replace the literal with t('your.key').
 */
export type Lang = 'en' | 'bn'
const KEY = 'iconnecto-lang'

const en = {
  'nav.home': 'Home',
  'nav.discover': 'Discover',
  'nav.create': 'Create',
  'nav.notifications': 'Alerts',
  'nav.profile': 'Profile',
  'nav.messages': 'Messages',
  'nav.communities': 'Communities',
  'nav.saved': 'Saved',
  'nav.settings': 'Settings',
  'nav.logout': 'Log out',
  'home.following': 'Following',
  'home.explore': 'Explore',
  'auth.login': 'Log in',
  'auth.signup': 'Sign up',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.username': 'Username',
  'auth.displayName': 'Display name',
  'auth.forgot': 'Forgot password?',
  'auth.newHere': 'New here?',
  'auth.haveAccount': 'Already have an account?',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.delete': 'Delete',
  'common.retry': 'Try again',
  'settings.title': 'Settings',
  'settings.appearance': 'Appearance',
  'settings.language': 'Language',
  'settings.theme.system': 'System',
  'settings.theme.light': 'Light',
  'settings.theme.dark': 'Dark',
} as const

export type MessageKey = keyof typeof en

const bn: Partial<Record<MessageKey, string>> = {
  'nav.home': 'হোম',
  'nav.discover': 'খুঁজুন',
  'nav.create': 'তৈরি',
  'nav.notifications': 'নোটিফিকেশন',
  'nav.profile': 'প্রোফাইল',
  'nav.messages': 'মেসেজ',
  'nav.communities': 'কমিউনিটি',
  'nav.saved': 'সংরক্ষিত',
  'nav.settings': 'সেটিংস',
  'nav.logout': 'লগ আউট',
  'home.following': 'ফলোয়িং',
  'home.explore': 'এক্সপ্লোর',
  'auth.login': 'লগ ইন',
  'auth.signup': 'সাইন আপ',
  'auth.email': 'ইমেইল',
  'auth.password': 'পাসওয়ার্ড',
  'auth.username': 'ইউজারনেম',
  'auth.displayName': 'প্রদর্শনের নাম',
  'auth.forgot': 'পাসওয়ার্ড ভুলে গেছেন?',
  'auth.newHere': 'নতুন?',
  'auth.haveAccount': 'ইতিমধ্যে অ্যাকাউন্ট আছে?',
  'common.cancel': 'বাতিল',
  'common.save': 'সংরক্ষণ',
  'common.delete': 'মুছুন',
  'common.retry': 'আবার চেষ্টা করুন',
  'settings.title': 'সেটিংস',
  'settings.appearance': 'চেহারা',
  'settings.language': 'ভাষা',
  'settings.theme.system': 'সিস্টেম',
  'settings.theme.light': 'লাইট',
  'settings.theme.dark': 'ডার্ক',
}

const DICTS: Record<Lang, Partial<Record<MessageKey, string>>> = { en, bn }

export const LANGUAGES: { value: Lang; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'bn', label: 'বাংলা' },
]

interface I18nApi {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: MessageKey) => string
}

const I18nContext = createContext<I18nApi | null>(null)

function readStored(): Lang {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'en' || v === 'bn') return v
  } catch {
    /* storage unavailable */
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('bn') ? 'bn' : 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStored)

  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    try {
      localStorage.setItem(KEY, l)
    } catch {
      /* ignore */
    }
  }, [])

  const t = useCallback((key: MessageKey) => DICTS[lang][key] ?? en[key], [lang])
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useT(): I18nApi {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useT must be used inside <I18nProvider>')
  return ctx
}
