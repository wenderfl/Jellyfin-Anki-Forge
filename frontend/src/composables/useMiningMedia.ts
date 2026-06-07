import { computed, onUnmounted, reactive, ref, type ComputedRef, type Ref } from 'vue';

import type { JellyfinMinerApi } from '@/api/jellyfin';
import type { MediaResponse, SubtitleCue } from '@/api/types';
import { toUserMessage } from '@/lib/errors';
import type { MinerSettings } from '@/lib/minerSettings';
import type { ToastApi } from '@/composables/useToast';

export interface UseMiningMediaOptions {
  apiClient: ComputedRef<JellyfinMinerApi | null>;
  selectedSessionId: Ref<string | null>;
  selectedTrackIndex: Ref<number | null>;
  currentCues: ComputedRef<readonly SubtitleCue[]>;
  settings: Ref<MinerSettings>;
  toast: ToastApi;
}

export function useMiningMedia(options: UseMiningMediaOptions) {
  const thumbnailDataUris = ref<Record<number, string>>({});
  const mediaLoading = ref<Record<string, boolean>>({});
  const mediaCache = reactive(new Map<string, MediaResponse>());
  const currentAudio = ref<HTMLAudioElement | null>(null);

  const imageLoadingIndexes = computed(() =>
    options.currentCues.value
      .map((cue) => cue.Index)
      .filter((cueIndex) => Boolean(mediaLoading.value[mediaKey('image', cueIndex, cueIndex)])),
  );
  const audioLoadingIndexes = computed(() =>
    options.currentCues.value
      .map((cue) => cue.Index)
      .filter((cueIndex) => Boolean(mediaLoading.value[mediaKey('audio', cueIndex, cueIndex)])),
  );

  onUnmounted(() => {
    stopAudio();
  });

  async function requestImage(
    cueIndex: number,
    endCueIndex = cueIndex,
  ): Promise<MediaResponse | null> {
    const client = options.apiClient.value;
    if (!client || !options.selectedSessionId.value || options.selectedTrackIndex.value == null) {
      return null;
    }

    const key = mediaKey('image', cueIndex, endCueIndex);
    const cached = mediaCache.get(key);
    if (cached) {
      thumbnailDataUris.value = {
        ...thumbnailDataUris.value,
        [cueIndex]: mediaDataUri(cached),
      };
      return cached;
    }

    mediaLoading.value[key] = true;
    try {
      const media = await client.createImage(options.selectedSessionId.value, {
        StreamIndex: options.selectedTrackIndex.value,
        CueIndex: cueIndex,
        EndCueIndex: endCueIndex,
        Format: options.settings.value.media.imageFormat,
        Quality: options.settings.value.media.imageQuality,
        Animated: options.settings.value.media.imageAnimated,
        Size: options.settings.value.media.imageSize,
      });
      mediaCache.set(key, media);
      thumbnailDataUris.value = {
        ...thumbnailDataUris.value,
        [cueIndex]: mediaDataUri(media),
      };
      return media;
    } catch (error) {
      options.toast.error(toUserMessage(error, 'Unable to generate screenshot.'));
      return null;
    } finally {
      delete mediaLoading.value[key];
    }
  }

  async function requestAndPlayAudio(
    cueIndex: number,
    endCueIndex = cueIndex,
  ): Promise<MediaResponse | null> {
    const media = await requestAudio(cueIndex, endCueIndex);
    if (media) {
      playAudio(media);
    }

    return media;
  }

  async function requestAudio(
    cueIndex: number,
    endCueIndex = cueIndex,
  ): Promise<MediaResponse | null> {
    const client = options.apiClient.value;
    if (!client || !options.selectedSessionId.value || options.selectedTrackIndex.value == null) {
      return null;
    }

    const key = mediaKey('audio', cueIndex, endCueIndex);
    const cached = mediaCache.get(key);
    if (cached) {
      return cached;
    }

    mediaLoading.value[key] = true;
    try {
      const media = await client.createAudio(options.selectedSessionId.value, {
        StreamIndex: options.selectedTrackIndex.value,
        StartCueIndex: cueIndex,
        EndCueIndex: endCueIndex,
        OffsetStartSeconds: options.settings.value.media.audioOffsetStart,
        OffsetEndSeconds: options.settings.value.media.audioOffsetEnd,
        Format: options.settings.value.media.audioFormat,
        Quality: options.settings.value.media.audioQuality,
        AudioFilterPreset: options.settings.value.media.audioFilterPreset,
      });
      mediaCache.set(key, media);
      return media;
    } catch (error) {
      options.toast.error(toUserMessage(error, 'Unable to generate audio.'));
      return null;
    } finally {
      delete mediaLoading.value[key];
    }
  }

  function isMediaLoading(type: 'audio' | 'image', cueIndex: number, endCueIndex: number): boolean {
    return Boolean(mediaLoading.value[mediaKey(type, cueIndex, endCueIndex)]);
  }

  function clearMedia(): void {
    thumbnailDataUris.value = {};
    mediaLoading.value = {};
    mediaCache.clear();
  }

  function playAudio(media: MediaResponse): void {
    stopAudio();
    const audio = new Audio(mediaDataUri(media));
    currentAudio.value = audio;
    audio.addEventListener('ended', () => {
      if (currentAudio.value === audio) {
        currentAudio.value = null;
      }
    });
    void audio.play();
  }

  function stopAudio(): void {
    if (currentAudio.value) {
      currentAudio.value.pause();
      currentAudio.value = null;
    }
  }

  function mediaKey(type: 'audio' | 'image', cueIndex: number, endCueIndex: number): string {
    return `${options.selectedSessionId.value ?? 'none'}:${options.selectedTrackIndex.value ?? 'none'}:${type}:${cueIndex}:${endCueIndex}`;
  }

  return {
    thumbnailDataUris,
    imageLoadingIndexes,
    audioLoadingIndexes,
    requestImage,
    requestAudio,
    requestAndPlayAudio,
    isMediaLoading,
    clearMedia,
  };
}

function mediaDataUri(media: MediaResponse): string {
  return `data:${media.MimeType};base64,${media.DataBase64}`;
}
