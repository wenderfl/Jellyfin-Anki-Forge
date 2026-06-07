export interface SubtitleCue {
  Index: number;
  StartMs: number;
  EndMs: number;
  Text: string;
}

export interface SubtitleTrack {
  Index: number;
  Language: string | null;
  DisplayTitle: string | null;
  Codec: string | null;
  IsExternal: boolean;
  IsDefault: boolean;
  IsForced: boolean;
}

export interface SessionSummary {
  SessionId: string;
  ItemId: string;
  ItemName: string;
  Client: string;
  DeviceName: string;
  PositionMs: number;
  IsPaused: boolean;
  ActiveSubtitleStreamIndex: number | null;
  ActiveAudioStreamIndex: number | null;
  LastReportedAtUtc: string;
  StateVersion: number;
}

export interface SessionManifest {
  SessionId: string;
  ItemId: string;
  ItemName: string;
  MediaSourceId: string;
  RuntimeMs: number | null;
  PositionMs: number;
  IsPaused: boolean;
  ActiveSubtitleStreamIndex: number | null;
  ActiveAudioStreamIndex: number | null;
  SubtitleTracks: SubtitleTrack[];
  LastReportedAtUtc: string;
  StateVersion: number;
}

export interface PlaybackStateResponse {
  SessionId: string;
  ItemId: string;
  MediaSourceId: string;
  PositionMs: number;
  IsPaused: boolean;
  ActiveSubtitleStreamIndex: number | null;
  ActiveAudioStreamIndex: number | null;
  ServerTimeUtc: string;
  LastReportedAtUtc: string;
  StateVersion: number;
}

export interface SubtitleCueResponse {
  SchemaVersion: number;
  ItemId: string;
  MediaSourceId: string;
  StreamIndex: number;
  Cues: SubtitleCue[];
}

export interface ImageMediaRequest {
  StreamIndex: number;
  CueIndex: number;
  EndCueIndex?: number | null;
  Format?: ImageFormat | null;
  Quality?: number | null;
  Animated?: boolean | null;
  Size?: string | null;
}

export interface AudioMediaRequest {
  StreamIndex: number;
  StartCueIndex: number;
  EndCueIndex?: number | null;
  OffsetStartSeconds?: number | null;
  OffsetEndSeconds?: number | null;
  Format?: AudioFormat | null;
  Quality?: number | null;
  AudioFilterPreset?: AudioFilterPreset | null;
}

export interface MediaResponse {
  SchemaVersion: number;
  MediaType: 'image' | 'audio';
  MimeType: string;
  Extension: string;
  FileNameHint: string;
  DataBase64: string;
}

export type ImageFormat = 'jpeg' | 'webp' | 'avif';
export type AudioFormat = 'mp3' | 'opus';
export type AudioFilterPreset = 'none' | 'loudnorm' | 'dynaudnorm' | 'voice_boost';

export interface ApiErrorResponse {
  Code: string;
  Message: string;
}

export interface JellyfinUser {
  Id: string;
  Name: string;
}

export interface JellyfinAuthResponse {
  AccessToken: string;
  User: JellyfinUser;
}

export interface AuthSession {
  accessToken: string;
  userId: string;
  username: string;
  deviceId: string;
  savedAt: string;
}

export interface LoginPayload {
  username: string;
  password: string;
  remember: boolean;
}

export interface SubtitleFetchResult {
  data: SubtitleCueResponse | null;
  etag: string | null;
  notModified: boolean;
}
