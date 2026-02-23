export type AuthState = 'checking' | 'logged-out' | 'logging-in' | 'logged-in' | 'logging-out';

export function shouldShowSignInDisclaimer(authState: AuthState): boolean {
  return authState === 'logged-out';
}
