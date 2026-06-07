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

async function findNotes(query: string): Promise<number[]> {
  return invoke<number[]>('findNotes', { query });
}

async function getNotesInfo(notes: number[]): Promise<NoteInfo[]> {
  return invoke<NoteInfo[]>('notesInfo', { notes });
}

async function getRecentNotes(count = 10, modelName?: string): Promise<NoteInfo[]> {
  let query = 'added:1';
  if (modelName) {
    query = `"note:${modelName}" added:1`;
  }

  let noteIds = await findNotes(query);
  if (noteIds.length === 0) {
    query = modelName ? `"note:${modelName}" added:7` : 'added:7';
    noteIds = await findNotes(query);
  }

  if (noteIds.length === 0) {
    return [];
  }

  return getNotesInfo([...noteIds].sort((a, b) => a - b).slice(-count));
}

export async function getLastNote(modelName?: string): Promise<NoteInfo | null> {
  const notes = await getRecentNotes(1, modelName);
  return notes[0] ?? null;
}

export async function storeMediaFile(filename: string, data: string): Promise<string> {
  return invoke<string>('storeMediaFile', { filename, data });
}

export async function updateNoteFields(
  noteId: number,
  fields: Record<string, string>,
): Promise<null> {
  return invoke<null>('updateNoteFields', {
    note: { id: noteId, fields },
  });
}

export async function guiBrowse(query: string): Promise<number[]> {
  return invoke<number[]>('guiBrowse', { query });
}
