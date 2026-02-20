import type { ArcGisPortalError, RestClientError } from './types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readPortalError(error: unknown): ArcGisPortalError {
  if (!isRecord(error)) {
    return {};
  }

  const nested = isRecord(error.error) ? error.error : error;

  return {
    code: typeof nested.code === 'number' ? nested.code : undefined,
    message: typeof nested.message === 'string' ? nested.message : undefined,
    details: nested.details
  };
}

export function mapRestError(error: unknown): RestClientError {
  const portalError = readPortalError(error);
  const message = portalError.message ?? 'Unexpected ArcGIS REST error.';

  if (portalError.code === 498 || portalError.code === 499) {
    return {
      code: 'SESSION_EXPIRED',
      message: 'Session expired. Sign in again to continue.',
      recoverable: true,
      httpStatus: portalError.code,
      details: portalError.details
    };
  }

  if (portalError.code === 403) {
    return {
      code: 'PERMISSION_DENIED',
      message: 'Permission denied for this ArcGIS operation.',
      recoverable: false,
      httpStatus: portalError.code,
      details: portalError.details
    };
  }

  if (portalError.code === 400) {
    return {
      code: 'INVALID_REQUEST',
      message: portalError.message ?? 'The ArcGIS request was invalid.',
      recoverable: false,
      httpStatus: portalError.code,
      details: portalError.details
    };
  }

  if (error instanceof Error && /network|fetch/i.test(error.message)) {
    return {
      code: 'NETWORK_ERROR',
      message: 'Network request failed. Check connectivity and try again.',
      recoverable: true,
      details: error.message
    };
  }

  return {
    code: 'UNKNOWN',
    message,
    recoverable: false,
    httpStatus: portalError.code,
    details: portalError.details
  };
}
