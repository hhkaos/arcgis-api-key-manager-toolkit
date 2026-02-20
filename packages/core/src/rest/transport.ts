import { getArcGisRestBaseUrl } from './client.js';
import type { ArcGisRestRequest, ArcGisRestTransport } from './types.js';

export class FetchArcGisRestTransport implements ArcGisRestTransport {
  public async request<TResponse>(request: ArcGisRestRequest): Promise<TResponse> {
    const baseUrl = getArcGisRestBaseUrl(request.environment);
    const url = new URL(`${baseUrl}${request.path}`);

    const payload = {
      f: 'json',
      token: request.accessToken,
      ...(request.query ?? {}),
      ...(request.body ?? {})
    };

    let response: Response;

    if (request.method === 'GET') {
      for (const [key, value] of Object.entries(payload)) {
        if (value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      }

      response = await fetch(url.toString(), { method: 'GET' });
    } else {
      const body = new URLSearchParams();
      for (const [key, value] of Object.entries(payload)) {
        if (value !== undefined) {
          body.set(key, String(value));
        }
      }

      response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: body.toString()
      });
    }

    const json = (await response.json()) as { error?: unknown } & TResponse;

    if (json.error) {
      throw json;
    }

    return json;
  }
}
