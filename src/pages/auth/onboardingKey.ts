/** localStorage flag set when the user skips (or finishes) profile setup, so the nudge stops appearing. */
export const ONBOARDING_SKIP_KEY = 'iconnecto-onboarding-skip'

export function markOnboardingDone(): void {
  try {
    localStorage.setItem(ONBOARDING_SKIP_KEY, '1')
  } catch {
    /* storage unavailable: the nudge may reappear, which is harmless */
  }
}

export function onboardingDismissed(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_SKIP_KEY) === '1'
  } catch {
    return false
  }
}
