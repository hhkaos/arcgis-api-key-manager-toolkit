import type { AuthAdapter, AuthToken, EnvironmentConfig } from '@arcgis-api-keys/core';

interface OAuthTokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: {
    message?: string;
  };
}

export class ChromeAuthAdapter implements AuthAdapter {
  public async signIn(environment: EnvironmentConfig): Promise<AuthToken> {
    const verifier = randomBase64Url(32);
    const challenge = await pkceChallenge(verifier);
    const state = randomBase64Url(18);
    const redirectUri = chrome.identity.getRedirectURL();

    const authorizeUrl = new URL(getAuthorizeUrl(environment));
    authorizeUrl.searchParams.set('client_id', environment.clientId);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('state', state);
    authorizeUrl.searchParams.set('code_challenge', challenge);
    authorizeUrl.searchParams.set('code_challenge_method', 'S256');
    authorizeUrl.searchParams.set('f', 'json');

    const callbackUrl = await chrome.identity.launchWebAuthFlow({
      url: authorizeUrl.toString(),
      interactive: true
    });

    if (!callbackUrl) {
      throw new Error('OAuth callback did not return a URL.');
    }

    const callback = new URL(callbackUrl);
    const code = callback.searchParams.get('code');
    const returnedState = callback.searchParams.get('state');
    const errorDescription = callback.searchParams.get('error_description');

    if (errorDescription) {
      throw new Error(`ArcGIS sign-in failed: ${errorDescription}`);
    }

    if (!code || returnedState !== state) {
      throw new Error('Invalid OAuth callback. Missing code or state mismatch.');
    }

    return this.exchangeCodeForToken(environment, {
      code,
      verifier,
      redirectUri
    });
  }

  public async signOut(_environment: EnvironmentConfig): Promise<void> {
    return;
  }

  private async exchangeCodeForToken(
    environment: EnvironmentConfig,
    params: { code: string; verifier: string; redirectUri: string }
  ): Promise<AuthToken> {
    const body = new URLSearchParams();
    body.set('client_id', environment.clientId);
    body.set('grant_type', 'authorization_code');
    body.set('code', params.code);
    body.set('redirect_uri', params.redirectUri);
    body.set('code_verifier', params.verifier);
    body.set('f', 'json');

    const response = await fetch(getTokenUrl(environment), {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed (${response.status}).`);
    }

    const payload = (await response.json()) as OAuthTokenResponse;
    if (payload.error) {
      throw new Error(payload.error.message ?? 'Token exchange failed.');
    }

    if (!payload.access_token || !payload.expires_in) {
      throw new Error('Token exchange response missing access token.');
    }

    return {
      accessToken: payload.access_token,
      tokenType: 'Bearer',
      expiresAt: Date.now() + payload.expires_in * 1000
    };
  }
}

function getAuthorizeUrl(environment: EnvironmentConfig): string {
  return `${getOauthBaseUrl(environment)}/oauth2/authorize`;
}

function getTokenUrl(environment: EnvironmentConfig): string {
  return `${getOauthBaseUrl(environment)}/oauth2/token`;
}

function getOauthBaseUrl(environment: EnvironmentConfig): string {
  if (environment.type === 'enterprise') {
    if (!environment.portalUrl) {
      throw new Error('Enterprise environment requires portal URL.');
    }

    return `${environment.portalUrl.replace(/\/$/, '')}/sharing/rest`;
  }

  return 'https://www.arcgis.com/sharing/rest';
}

function randomBase64Url(size: number): string {
  const bytes = new Uint8Array(size);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function pkceChallenge(verifier: string): Promise<string> {
  const source = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', source);
  return bytesToBase64Url(new Uint8Array(digest));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const value of bytes) {
    binary += String.fromCharCode(value);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
