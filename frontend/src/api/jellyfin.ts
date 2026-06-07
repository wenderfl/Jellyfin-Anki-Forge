import type {
  ApiErrorResponse,
  AuthSession,
  AudioMediaRequest,
  ImageMediaRequest,
  MediaResponse,
  JellyfinAuthResponse,
  PlaybackStateResponse,
  SessionManifest,
  SessionSummary,
  SubtitleCueResponse,
  SubtitleFetchResult,
} from './types';

const PLUGIN_ROUTE = '/Plugins/JellyfinMiner';
const PLUGIN_API_PATH = `${PLUGIN_ROUTE}/api/v1`;
const JELLYFIN_AUTH_HEADER = 'X-Emby-Authorization';
const CLIENT_NAME = 'Jellyfin Miner';
const DEVICE_NAME = 'Browser';
const CLIENT_VERSION = '0.1.0';

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

function createDeviceId(): string {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `browser-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
}

function buildMediaBrowserAuthorization(deviceId: string, token?: string): string {
  const parts: Array<[string, string]> = [
    ['Client', CLIENT_NAME],
    ['Device', DEVICE_NAME],
    ['DeviceId', deviceId],
    ['Version', CLIENT_VERSION],
  ];

  if (token) {
    parts.push(['Token', token]);
  }

  return `MediaBrowser ${parts
    .map(([key, value]) => `${key}="${escapeHeaderValue(value)}"`)
    .join(', ')}`;
}

export async function authenticate(
  username: string,
  password: string,
  deviceId = createDeviceId(),
): Promise<AuthSession> {
  const response = await fetch(jellyfinPath('/Users/AuthenticateByName'), {
    method: 'POST',
    headers: {
      [JELLYFIN_AUTH_HEADER]: buildMediaBrowserAuthorization(deviceId),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      Username: username,
      Pw: password,
    }),
  });

  if (!response.ok) {
    throw await toApiError(response, 'Unable to sign in to Jellyfin.');
  }

  const data = (await response.json()) as JellyfinAuthResponse;
  return {
    accessToken: data.AccessToken,
    userId: data.User.Id,
    username: data.User.Name || username,
    deviceId,
    savedAt: new Date().toISOString(),
  };
}

export class JellyfinMinerApi {
  constructor(private readonly auth: AuthSession) {}

  async getSessions(): Promise<SessionSummary[]> {
    return this.requestJson<SessionSummary[]>('/sessions');
  }

  async getManifest(sessionId: string): Promise<SessionManifest> {
    return this.requestJson<SessionManifest>(`/sessions/${encodeURIComponent(sessionId)}/manifest`);
  }

  async getState(sessionId: string): Promise<PlaybackStateResponse> {
    return this.requestJson<PlaybackStateResponse>(
      `/sessions/${encodeURIComponent(sessionId)}/state`,
    );
  }

  async getSubtitles(
    sessionId: string,
    streamIndex: number,
    etag?: string,
  ): Promise<SubtitleFetchResult> {
    const headers = this.authHeaders();
    if (etag) {
      headers.set('If-None-Match', etag);
    }

    const response = await fetch(
      this.url(`/sessions/${encodeURIComponent(sessionId)}/subtitles/${streamIndex}`),
      {
        headers,
      },
    );

    const nextEtag = response.headers.get('ETag');
    if (response.status === 304) {
      return {
        data: null,
        etag: nextEtag ?? etag ?? null,
        notModified: true,
      };
    }

    if (!response.ok) {
      throw await toApiError(response, 'The subtitle track could not be loaded.');
    }

    return {
      data: (await response.json()) as SubtitleCueResponse,
      etag: nextEtag,
      notModified: false,
    };
  }

  async createImage(sessionId: string, request: ImageMediaRequest): Promise<MediaResponse> {
    return this.requestJson<MediaResponse>(
      `/sessions/${encodeURIComponent(sessionId)}/media/image`,
      request,
    );
  }

  async createAudio(sessionId: string, request: AudioMediaRequest): Promise<MediaResponse> {
    return this.requestJson<MediaResponse>(
      `/sessions/${encodeURIComponent(sessionId)}/media/audio`,
      request,
    );
  }

  private async requestJson<TResponse>(path: string, body?: unknown): Promise<TResponse> {
    const headers = this.authHeaders();
    if (body !== undefined) {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(this.url(path), {
      method: body === undefined ? 'GET' : 'POST',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
      throw await toApiError(response, 'The Jellyfin Miner request failed.');
    }

    return (await response.json()) as TResponse;
  }

  private authHeaders(): Headers {
    return new Headers({
      [JELLYFIN_AUTH_HEADER]: buildMediaBrowserAuthorization(
        this.auth.deviceId,
        this.auth.accessToken,
      ),
    });
  }

  private url(path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return jellyfinPath(`${PLUGIN_API_PATH}${normalizedPath}`);
  }
}

function jellyfinPath(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${jellyfinBasePath()}${normalizedPath}`;
}

function jellyfinBasePath(): string {
  const pathname = window.location.pathname;
  const markerIndex = pathname.toLowerCase().indexOf(PLUGIN_ROUTE.toLowerCase());
  if (markerIndex <= 0) {
    return '';
  }

  return pathname.slice(0, markerIndex).replace(/\/+$/, '');
}

function escapeHeaderValue(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

async function toApiError(response: Response, fallbackMessage: string): Promise<ApiRequestError> {
  const body = await tryReadApiError(response);
  return new ApiRequestError(
    response.status,
    body?.Message || response.statusText || fallbackMessage,
    body?.Code,
  );
}

async function tryReadApiError(response: Response): Promise<ApiErrorResponse | null> {
  const contentType = response.headers.get('Content-Type') ?? '';
  if (!contentType.includes('application/json')) {
    return null;
  }

  try {
    const body: unknown = await response.json();
    if (isApiErrorResponse(body)) {
      return body;
    }
  } catch {
    return null;
  }

  return null;
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return typeof candidate.Code === 'string' && typeof candidate.Message === 'string';
}
