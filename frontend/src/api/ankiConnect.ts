const ANKI_CONNECT_URL = 'http://127.0.0.1:8765';
const API_VERSION = 6;

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

interface AnkiRequest {
  action: string;
  version: number;
  params?: JsonValue;
}

interface AnkiResponse<T = JsonValue> {
  result: T;
  error: string | null;
}

interface AnkiActionRequest {
  action: string;
  version: number;
  params: Record<string, JsonValue>;
}

interface AnkiActionResponse<T = JsonValue> {
  result: T;
  error: string | null;
}

export interface NoteInfo {
  noteId: number;
  modelName: string;
  tags: string[];
  fields: Record<string, { value: string; order: number }>;
}

class AnkiConnectError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AnkiConnectError';
  }
}

async function invoke<T>(action: string, params?: JsonValue): Promise<T> {
  const request: AnkiRequest = { action, version: API_VERSION };
  if (params !== undefined) {
    request.params = params;
  }

  let response: Response;
  try {
    response = await fetch(ANKI_CONNECT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new AnkiConnectError(`[${action}] Network error: ${message}`);
  }

  if (!response.ok) {
    throw new AnkiConnectError(`[${action}] HTTP ${response.status}: ${response.statusText}`);
  }

  let data: AnkiResponse<T>;
  try {
    data = (await response.json()) as AnkiResponse<T>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new AnkiConnectError(`[${action}] Failed to parse response: ${message}`);
  }

  if (data.error) {
    throw new AnkiConnectError(`[${action}] ${data.error}`);
  }

  return data.result;
}

async function multiInvoke<T>(actions: AnkiActionRequest[]): Promise<Array<AnkiActionResponse<T>>> {
  return invoke<Array<AnkiActionResponse<T>>>('multi', {
    actions: actions as unknown as JsonValue,
  });
}

export async function getVersion(): Promise<number> {
  return invoke<number>('version');
}

export async function getDeckNames(): Promise<string[]> {
  return invoke<string[]>('deckNames');
}

async function getModelNames(): Promise<string[]> {
  return invoke<string[]>('modelNames');
}

export async function getModelsWithFields(): Promise<Record<string, string[]>> {
  const modelNames = await getModelNames();
  const actions = modelNames.map((modelName) => ({
    action: 'modelFieldNames',
    version: API_VERSION,
    params: { modelName },
  }));

  const results = await multiInvoke<string[]>(actions);
  const modelsWithFields: Record<string, string[]> = {};
  modelNames.forEach((modelName, index) => {
    const item = results[index];
    modelsWithFields[modelName] = item && !item.error ? (item.result ?? []) : [];
  });

  return modelsWithFields;
}

export async function storeMediaFile(filename: string, data: string): Promise<string> {
  return invoke<string>('storeMediaFile', { filename, data });
}

export interface AnkiMedia {
  filename: string;
  data: string;
  fields: string[];
}

export async function addNote(
  deckName: string,
  modelName: string,
  fields: Record<string, string>,
  audio?: AnkiMedia[],
  picture?: AnkiMedia[]
): Promise<number> {
  return invoke<number>('addNote', {
    note: {
      deckName,
      modelName,
      fields,
      audio,
      picture,
      options: {
        allowDuplicate: true,
      },
    } as any,
  });
}

export async function guiBrowse(query: string): Promise<number[]> {
  return invoke<number[]>('guiBrowse', { query });
}


