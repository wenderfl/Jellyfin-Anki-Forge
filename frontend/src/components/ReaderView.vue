<template>
  <section class="reader-view">
    <header class="reader-toolbar">
      <div class="reader-title">
        <p>{{ statusText }}</p>
        <h1>{{ manifest?.ItemName ?? 'Select a stream' }}</h1>
      </div>

      <div class="toolbar-cluster">
        <button
          class="time-pill"
          type="button"
          aria-label="Scroll to current subtitle"
          @click="scrollToActiveCue"
        >
          <Clock3 :size="16" />
          <span>{{ formatDuration(positionMs) }}</span>
          <span v-if="manifest?.RuntimeMs">/ {{ formatDuration(manifest.RuntimeMs) }}</span>
        </button>
        <button
          class="icon-button"
          type="button"
          aria-label="Reload subtitles"
          @click="emit('reloadSubtitles')"
        >
          <RefreshCw :size="18" />
        </button>
      </div>
    </header>

    <div v-if="!manifest" class="reader-empty">
      <MonitorPlay :size="34" />
      <h2>No stream selected</h2>
      <p>Choose an active stream to follow its subtitles.</p>
    </div>

    <template v-else>
      <div class="track-bar">
        <label class="track-select">
          <Captions :size="18" />
          <select
            :value="selectedTrackIndex ?? ''"
            :disabled="manifest.SubtitleTracks.length === 0"
            @change="onTrackChange"
          >
            <option v-if="manifest.SubtitleTracks.length === 0" value="">No subtitle tracks</option>
            <option
              v-for="track in manifest.SubtitleTracks"
              :key="track.Index"
              :value="track.Index"
            >
              {{ trackLabel(track) }}
            </option>
          </select>
        </label>

        <span v-if="subtitleLoading" class="track-state">
          <LoaderCircle class="spin" :size="16" />
          Loading subtitles
        </span>
        <span v-else-if="subtitleError" class="track-state error">
          <CircleAlert :size="16" />
          {{ subtitleError }}
        </span>
        <span v-else class="track-state">
          <ScrollText :size="16" />
          {{ cues.length }} cues
        </span>
      </div>

      <SubtitleTranscript
        ref="transcript"
        :cues="cues"
        :active-cue-index="activeCueIndex"
        :position-ms="positionMs"
        :follow="follow"
        :selected-cue-indexes="selectedCueIndexes"
        :thumbnail-data-uris="thumbnailDataUris"
        :image-loading-indexes="imageLoadingIndexes"
        :audio-loading-indexes="audioLoadingIndexes"
        @toggle-cue="emit('toggleCue', $event)"
        @request-image="emit('requestImage', $event)"
        @request-audio="emit('requestAudio', $event)"
      />
    </template>
  </section>
</template>

<script setup lang="ts">
import {
  Captions,
  CircleAlert,
  Clock3,
  LoaderCircle,
  MonitorPlay,
  RefreshCw,
  ScrollText,
} from '@lucide/vue';
import { computed, ref } from 'vue';

import type {
  PlaybackStateResponse,
  SessionManifest,
  SubtitleCue,
  SubtitleTrack,
} from '@/api/types';
import { formatDuration } from '@/lib/playback';

import SubtitleTranscript from './SubtitleTranscript.vue';

type SubtitleTranscriptHandle = {
  scrollToTop: () => void;
  scrollToActiveCue: () => void;
};

const props = defineProps<{
  manifest: SessionManifest | null;
  playbackState: PlaybackStateResponse | null;
  positionMs: number;
  cues: readonly SubtitleCue[];
  activeCueIndex: number;
  selectedTrackIndex: number | null;
  subtitleLoading: boolean;
  subtitleError: string | null;
  follow: boolean;
  selectedCueIndexes: readonly number[];
  thumbnailDataUris: Readonly<Record<number, string>>;
  imageLoadingIndexes: readonly number[];
  audioLoadingIndexes: readonly number[];
}>();

const emit = defineEmits<{
  selectTrack: [streamIndex: number];
  reloadSubtitles: [];
  toggleCue: [cueIndex: number];
  requestImage: [cueIndex: number];
  requestAudio: [cueIndex: number];
}>();

const transcript = ref<SubtitleTranscriptHandle | null>(null);

const statusText = computed(() => {
  if (!props.manifest) {
    return 'Waiting';
  }

  if (!props.playbackState) {
    return 'Syncing';
  }

  return props.playbackState.IsPaused ? 'Paused' : 'Following';
});

function onTrackChange(event: Event): void {
  const target = event.target as HTMLSelectElement;
  const value = Number(target.value);
  if (Number.isInteger(value)) {
    emit('selectTrack', value);
  }
}

function trackLabel(track: SubtitleTrack): string {
  const parts = [
    track.DisplayTitle || track.Language || `Subtitle ${track.Index}`,
    track.Codec?.toUpperCase(),
    track.IsExternal ? 'External' : 'Embedded',
    track.IsDefault ? 'Default' : null,
    track.IsForced ? 'Forced' : null,
  ].filter(Boolean);

  return parts.join(' · ');
}

function scrollToTop(): void {
  transcript.value?.scrollToTop();
}

function scrollToActiveCue(): void {
  transcript.value?.scrollToActiveCue();
}

defineExpose({
  scrollToTop,
  scrollToActiveCue,
});
</script>
