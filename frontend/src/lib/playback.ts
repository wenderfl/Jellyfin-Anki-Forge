import type { PlaybackStateResponse, SessionSummary } from '@/api/types';

export function estimateDisplayPositionMs(
  state: PlaybackStateResponse | null,
  nowMs = Date.now(),
): number {
  if (!state) {
    return 0;
  }

  if (state.IsPaused) {
    return state.PositionMs;
  }

  const serverTimeMs = Date.parse(state.ServerTimeUtc);
  if (!Number.isFinite(serverTimeMs)) {
    return state.PositionMs;
  }

  return Math.max(state.PositionMs, state.PositionMs + Math.max(0, nowMs - serverTimeMs));
}

export function isSessionStale(
  session: Pick<SessionSummary, 'LastReportedAtUtc'>,
  nowMs = Date.now(),
): boolean {
  const lastReportedMs = Date.parse(session.LastReportedAtUtc);
  if (!Number.isFinite(lastReportedMs)) {
    return true;
  }

  return nowMs - lastReportedMs > 15_000;
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms)) {
    return '--:--';
  }

  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${pad2(minutes)}:${pad2(seconds)}`;
  }

  return `${minutes}:${pad2(seconds)}`;
}

function pad2(value: number): string {
  return value.toString().padStart(2, '0');
}
