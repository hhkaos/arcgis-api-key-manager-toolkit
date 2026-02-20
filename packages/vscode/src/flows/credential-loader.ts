import type { ApiKeyCredential, AuthToken, HostToWebviewMessage } from '@arcgis-api-keys/core';

interface CredentialLoaderInput {
  token: AuthToken | null;
  fetchCredentials: (accessToken: string) => Promise<ApiKeyCredential[]>;
  fetchWarnings?: () => string[];
  nowMs?: number;
}

export async function buildCredentialLoadMessage(
  input: CredentialLoaderInput
): Promise<HostToWebviewMessage> {
  const nowMs = input.nowMs ?? Date.now();

  if (!input.token) {
    return {
      type: 'host/error',
      payload: {
        message: 'Not signed in. Sign in to continue.',
        code: 'SESSION_EXPIRED',
        recoverable: true
      }
    };
  }

  if (input.token.expiresAt <= nowMs) {
    return {
      type: 'host/error',
      payload: {
        message: 'Session expired. Sign in again to continue.',
        code: 'SESSION_EXPIRED',
        recoverable: true
      }
    };
  }

  try {
    const credentials = await input.fetchCredentials(input.token.accessToken);
    const sortedCredentials = sortByCreatedDesc(credentials);
    const payload: { credentials: ApiKeyCredential[] } = { credentials: sortedCredentials };
    const warnings = input.fetchWarnings?.() ?? [];
    if (warnings.length > 0) {
      (payload as Record<string, unknown>).warnings = warnings;
    }

    return {
      type: 'host/credentials',
      payload
    };
  } catch (error) {
    const mapped = mapError(error);
    return {
      type: 'host/error',
      payload: {
        message: mapped.message,
        code: mapped.code,
        recoverable: mapped.recoverable
      }
    };
  }
}

function sortByCreatedDesc(credentials: ApiKeyCredential[]): ApiKeyCredential[] {
  return [...credentials].sort(
    (left, right) => Date.parse(right.created) - Date.parse(left.created)
  );
}

function mapError(error: unknown): { code: string; message: string; recoverable: boolean } {
  if (isRecord(error) && isRecord(error.error)) {
    const code = readNumber(error.error.code);
    const message = readString(error.error.message) ?? 'Unexpected ArcGIS REST error.';

    if (code === 498 || code === 499) {
      return {
        code: 'SESSION_EXPIRED',
        message: 'Session expired. Sign in again to continue.',
        recoverable: true
      };
    }

    if (code === 403) {
      return {
        code: 'PERMISSION_DENIED',
        message: 'Permission denied for this ArcGIS operation.',
        recoverable: false
      };
    }

    return {
      code: 'UNKNOWN',
      message,
      recoverable: false
    };
  }

  if (error instanceof Error && /network|fetch/i.test(error.message)) {
    return {
      code: 'NETWORK_ERROR',
      message: 'Network request failed. Check connectivity and try again.',
      recoverable: true
    };
  }

  return {
    code: 'UNKNOWN',
    message: 'Unexpected ArcGIS REST error.',
    recoverable: false
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}
