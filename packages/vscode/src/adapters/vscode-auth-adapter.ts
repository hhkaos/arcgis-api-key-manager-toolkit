import { createHash, randomBytes } from 'node:crypto';
import type { AuthAdapter, AuthToken, EnvironmentConfig } from '@arcgis-api-keys/core';
import * as vscode from 'vscode';

interface PendingAuthRequest {
  resolve: (value: vscode.Uri) => void;
  reject: (reason?: unknown) => void;
  timeout: ReturnType<typeof setTimeout>;
}

interface OAuthTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: {
    message?: string;
  };
}

const AUTH_TIMEOUT_MS = 3 * 60 * 1000;

export class VscodeAuthAdapter implements AuthAdapter, vscode.UriHandler {
  private readonly context: vscode.ExtensionContext;
  private readonly pendingByState = new Map<string, PendingAuthRequest>();

  public constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  public async signIn(environment: EnvironmentConfig): Promise<AuthToken> {
    const verifier = toBase64Url(randomBytes(32));
    const challenge = toBase64Url(createHash('sha256').update(verifier).digest());
    const state = toBase64Url(randomBytes(18));
    const redirectUri = `${vscode.env.uriScheme}://${this.context.extension.id}/auth-callback`;

    const authorizeUrl = new URL(getAuthorizeUrl(environment));
    authorizeUrl.searchParams.set('client_id', environment.clientId);
    authorizeUrl.searchParams.set('response_type', 'code');
    authorizeUrl.searchParams.set('redirect_uri', redirectUri);
    authorizeUrl.searchParams.set('state', state);
    authorizeUrl.searchParams.set('code_challenge', challenge);
    authorizeUrl.searchParams.set('code_challenge_method', 'S256');
    authorizeUrl.searchParams.set('f', 'json');

    const callbackPromise = this.waitForCallback(state);

    const opened = await vscode.env.openExternal(vscode.Uri.parse(authorizeUrl.toString()));
    if (!opened) {
      this.rejectPending(state, new Error('Unable to open browser for sign-in.'));
      throw new Error('Unable to open browser for sign-in.');
    }

    const callbackUri = await callbackPromise;
    const code = new URLSearchParams(callbackUri.query).get('code');
    const returnedState = new URLSearchParams(callbackUri.query).get('state');
    const errorDescription = new URLSearchParams(callbackUri.query).get('error_description');

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

  public handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
    const params = new URLSearchParams(uri.query);
    const state = params.get('state');
    if (!state) {
      return;
    }

    const pending = this.pendingByState.get(state);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingByState.delete(state);
    pending.resolve(uri);
  }

  private waitForCallback(state: string): Promise<vscode.Uri> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingByState.delete(state);
        reject(new Error('Timed out waiting for OAuth callback.'));
      }, AUTH_TIMEOUT_MS);

      this.pendingByState.set(state, {
        resolve,
        reject,
        timeout
      });
    });
  }

  private async exchangeCodeForToken(
    environment: EnvironmentConfig,
    params: { code: string; verifier: string; redirectUri: string }
  ): Promise<AuthToken> {
    const tokenUrl = getTokenUrl(environment);
    const body = new URLSearchParams();

    body.set('client_id', environment.clientId);
    body.set('grant_type', 'authorization_code');
    body.set('code', params.code);
    body.set('redirect_uri', params.redirectUri);
    body.set('code_verifier', params.verifier);
    body.set('f', 'json');

    const response = await fetch(tokenUrl, {
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

  private rejectPending(state: string, reason: unknown): void {
    const pending = this.pendingByState.get(state);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingByState.delete(state);
    pending.reject(reason);
  }
}

function getAuthorizeUrl(environment: EnvironmentConfig): string {
  const base = getOauthBaseUrl(environment);
  return `${base}/oauth2/authorize`;
}

function getTokenUrl(environment: EnvironmentConfig): string {
  const base = getOauthBaseUrl(environment);
  return `${base}/oauth2/token`;
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

function toBase64Url(value: Buffer): string {
  return value
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
