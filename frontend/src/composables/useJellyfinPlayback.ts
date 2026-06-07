import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

import { ApiRequestError, authenticate, JellyfinMinerApi } from '@/api/jellyfin';
import type {
  AuthSession,
  LoginPayload,
  PlaybackStateResponse,
  SessionManifest,
  SessionSummary,
} from '@/api/types';
import { clearStoredAuth, loadStoredAuth, saveStoredAuth } from '@/lib/authStorage';
import { toUserMessage } from '@/lib/errors';
import { estimateDisplayPositionMs } from '@/lib/playback';

export function useJellyfinPlayback() {
  const auth = ref<AuthSession | null>(loadStoredAuth());
  const loginLoading = ref(false);
  const loginError = ref<string | null>(null);

  const sessions = ref<SessionSummary[]>([]);
  const sessionsLoading = ref(false);
  const sessionsError = ref<string | null>(null);
  const selectedSessionId = ref<string | null>(null);

  const manifest = ref<SessionManifest | null>(null);
  const playbackState = ref<PlaybackStateResponse | null>(null);
  const displayPositionMs = ref(0);
  const selectedTrackIndex = ref<number | null>(null);
  const manualTrackSelection = ref(false);

  let sessionTimer: number | undefined;
  let stateTimer: number | undefined;
  let animationFrame: number | undefined;

  const apiClient = computed(() => (auth.value ? new JellyfinMinerApi(auth.value) : null));

  watch(
    auth,
    (nextAuth) => {
      stopSessionPolling();
      stopStatePolling();

      if (!nextAuth) {
        resetPlayback();
        return;
      }

      void refreshSessions();
      startSessionPolling();
    },
    { immediate: true },
  );

  watch(selectedSessionId, (sessionId) => {
    stopStatePolling();
    resetPlayback();

    if (!sessionId) {
      return;
    }

    void loadManifest(sessionId);
    void refreshPlaybackState(sessionId);
    startStatePolling();
  });

  watch(playbackState, (state) => {
    if (!state || manualTrackSelection.value || !manifest.value) {
      return;
    }

    const activeIndex = state.ActiveSubtitleStreamIndex;
    if (
      activeIndex != null &&
      activeIndex !== selectedTrackIndex.value &&
      manifest.value.SubtitleTracks.some((track) => track.Index === activeIndex)
    ) {
      selectedTrackIndex.value = activeIndex;
    }
  });

  onMounted(() => {
    startPositionLoop();
  });

  onUnmounted(() => {
    stopSessionPolling();
    stopStatePolling();
    if (animationFrame != null) {
      window.cancelAnimationFrame(animationFrame);
    }
  });

  async function login(payload: LoginPayload): Promise<void> {
    loginLoading.value = true;
    loginError.value = null;

    try {
      const nextAuth = await authenticate(payload.username, payload.password);
      saveStoredAuth(nextAuth, payload.remember);
      auth.value = nextAuth;
    } catch (error) {
      loginError.value = toUserMessage(error, 'Unable to sign in.');
    } finally {
      loginLoading.value = false;
    }
  }

  function logout(): void {
    clearStoredAuth();
    auth.value = null;
    sessions.value = [];
    sessionsError.value = null;
    loginError.value = null;
  }

  async function refreshSessions(): Promise<void> {
    const client = apiClient.value;
    if (!client) {
      return;
    }

    sessionsLoading.value = sessions.value.length === 0;

    try {
      const nextSessions = await client.getSessions();
      sessions.value = nextSessions;
      sessionsError.value = null;

      if (
        selectedSessionId.value &&
        !nextSessions.some((session) => session.SessionId === selectedSessionId.value)
      ) {
        selectedSessionId.value = null;
      }

      if (!selectedSessionId.value && nextSessions.length > 0) {
        selectedSessionId.value = nextSessions[0]?.SessionId ?? null;
      }
    } catch (error) {
      handleApiFailure(error, 'Unable to load streams.');
    } finally {
      sessionsLoading.value = false;
    }
  }

  function selectSession(sessionId: string): void {
    selectedSessionId.value = sessionId;
  }

  function selectTrack(streamIndex: number): void {
    manualTrackSelection.value = true;
    selectedTrackIndex.value = streamIndex;
  }

  async function loadManifest(sessionId: string): Promise<void> {
    const client = apiClient.value;
    if (!client) {
      return;
    }

    try {
      const nextManifest = await client.getManifest(sessionId);
      if (selectedSessionId.value !== sessionId) {
        return;
      }

      manifest.value = nextManifest;
      const currentTrackStillExists =
        selectedTrackIndex.value != null &&
        nextManifest.SubtitleTracks.some((track) => track.Index === selectedTrackIndex.value);

      if (!manualTrackSelection.value || !currentTrackStillExists) {
        selectedTrackIndex.value = pickDefaultTrack(nextManifest);
        manualTrackSelection.value = false;
      }
    } catch (error) {
      handleApiFailure(error, 'Unable to load stream details.');
    }
  }

  async function refreshPlaybackState(sessionId = selectedSessionId.value): Promise<void> {
    const client = apiClient.value;
    if (!client || !sessionId) {
      return;
    }

    try {
      const nextState = await client.getState(sessionId);
      if (selectedSessionId.value !== sessionId) {
        return;
      }

      playbackState.value = nextState;
      displayPositionMs.value = estimateDisplayPositionMs(nextState);
    } catch (error) {
      handleApiFailure(error, 'Unable to sync playback.');
    }
  }

  function resetPlayback(): void {
    manifest.value = null;
    playbackState.value = null;
    displayPositionMs.value = 0;
    selectedTrackIndex.value = null;
    manualTrackSelection.value = false;
  }

  function startSessionPolling(): void {
    stopSessionPolling();
    sessionTimer = window.setInterval(() => {
      void refreshSessions();
    }, 3_000);
  }

  function stopSessionPolling(): void {
    if (sessionTimer != null) {
      window.clearInterval(sessionTimer);
      sessionTimer = undefined;
    }
  }

  function startStatePolling(): void {
    stopStatePolling();
    stateTimer = window.setInterval(() => {
      void refreshPlaybackState();
    }, 1_000);
  }

  function stopStatePolling(): void {
    if (stateTimer != null) {
      window.clearInterval(stateTimer);
      stateTimer = undefined;
    }
  }

  function startPositionLoop(): void {
    const tick = (): void => {
      displayPositionMs.value = estimateDisplayPositionMs(playbackState.value);
      animationFrame = window.requestAnimationFrame(tick);
    };

    animationFrame = window.requestAnimationFrame(tick);
  }

  function handleApiFailure(error: unknown, fallback: string): void {
    if (error instanceof ApiRequestError) {
      if (error.status === 401) {
        loginError.value = 'Your Jellyfin session expired.';
        logout();
        return;
      }

      if (error.status === 404) {
        selectedSessionId.value = null;
        sessionsError.value = 'That stream is no longer active.';
        void refreshSessions();
        return;
      }
    }

    sessionsError.value = toUserMessage(error, fallback);
  }

  return {
    auth,
    loginLoading,
    loginError,
    sessions,
    sessionsLoading,
    sessionsError,
    selectedSessionId,
    manifest,
    playbackState,
    displayPositionMs,
    selectedTrackIndex,
    apiClient,
    login,
    logout,
    refreshSessions,
    selectSession,
    selectTrack,
  };
}

function pickDefaultTrack(nextManifest: SessionManifest): number | null {
  const tracks = nextManifest.SubtitleTracks;
  if (tracks.length === 0) {
    return null;
  }

  const activeIndex = nextManifest.ActiveSubtitleStreamIndex;
  if (activeIndex != null && tracks.some((track) => track.Index === activeIndex)) {
    return activeIndex;
  }

  return tracks.find((track) => track.IsDefault)?.Index ?? tracks[0]?.Index ?? null;
}
