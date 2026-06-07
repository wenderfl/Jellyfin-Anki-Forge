import { computed, reactive, ref, watch, type ComputedRef, type Ref } from 'vue';

import { ApiRequestError, type JellyfinMinerApi } from '@/api/jellyfin';
import type { SubtitleCue } from '@/api/types';
import { toUserMessage } from '@/lib/errors';

interface SubtitleCacheEntry {
  cues: SubtitleCue[];
  etag: string | null;
  loadedAtMs: number;
}

export interface UseSubtitleTracksOptions {
  apiClient: ComputedRef<JellyfinMinerApi | null>;
  selectedSessionId: Ref<string | null>;
  selectedTrackIndex: Ref<number | null>;
  displayPositionMs: Ref<number>;
  logout: () => void;
}

export function useSubtitleTracks(options: UseSubtitleTracksOptions) {
  const subtitleLoading = ref(false);
  const subtitleError = ref<string | null>(null);
  const follow = ref(true);
  const subtitleCache = reactive(new Map<string, SubtitleCacheEntry>());

  const currentSubtitleEntry = computed(() => {
    if (!options.selectedSessionId.value || options.selectedTrackIndex.value == null) {
      return null;
    }

    return (
      subtitleCache.get(
        cacheKey(options.selectedSessionId.value, options.selectedTrackIndex.value),
      ) ?? null
    );
  });
  const currentCues = computed(() => currentSubtitleEntry.value?.cues ?? []);
  const activeCueIndex = computed(() =>
    findActiveCueIndex(currentCues.value, options.displayPositionMs.value),
  );

  watch(options.selectedTrackIndex, (streamIndex) => {
    resetSubtitleState();
    if (!options.selectedSessionId.value || streamIndex == null) {
      return;
    }

    void loadSubtitles(options.selectedSessionId.value, streamIndex);
  });

  async function loadSubtitles(
    sessionId: string,
    streamIndex: number,
    force = false,
  ): Promise<void> {
    const client = options.apiClient.value;
    if (!client) {
      return;
    }

    const key = cacheKey(sessionId, streamIndex);
    const cached = subtitleCache.get(key);
    subtitleLoading.value = !cached || force;
    subtitleError.value = null;

    try {
      const result = await client.getSubtitles(
        sessionId,
        streamIndex,
        force ? undefined : (cached?.etag ?? undefined),
      );
      if (
        options.selectedSessionId.value !== sessionId ||
        options.selectedTrackIndex.value !== streamIndex
      ) {
        return;
      }

      if (result.notModified) {
        if (!cached) {
          subtitleError.value = 'No cached subtitles are available.';
        }
        return;
      }

      if (result.data) {
        subtitleCache.set(key, {
          cues: result.data.Cues,
          etag: result.etag,
          loadedAtMs: Date.now(),
        });
      }
    } catch (error) {
      subtitleError.value = toUserMessage(error, 'The subtitle track could not be loaded.');
      if (error instanceof ApiRequestError && error.status === 401) {
        options.logout();
      }
    } finally {
      subtitleLoading.value = false;
    }
  }

  function reloadCurrentSubtitles(): void {
    if (!options.selectedSessionId.value || options.selectedTrackIndex.value == null) {
      return;
    }

    void loadSubtitles(options.selectedSessionId.value, options.selectedTrackIndex.value, true);
  }

  function resetSubtitleState(): void {
    subtitleLoading.value = false;
    subtitleError.value = null;
  }

  return {
    subtitleLoading,
    subtitleError,
    follow,
    currentCues,
    activeCueIndex,
    reloadCurrentSubtitles,
  };
}

function cacheKey(sessionId: string, streamIndex: number): string {
  return `${sessionId}:${streamIndex}`;
}

function findActiveCueIndex(cues: readonly SubtitleCue[], positionMs: number): number {
  let low = 0;
  let high = cues.length - 1;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const cue = cues[middle];
    if (!cue) {
      return -1;
    }

    if (positionMs < cue.StartMs) {
      high = middle - 1;
    } else if (positionMs >= cue.EndMs) {
      low = middle + 1;
    } else {
      return middle;
    }
  }

  return -1;
}
