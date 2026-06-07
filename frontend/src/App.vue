<template>
  <LoginPanel v-if="!auth" :is-loading="loginLoading" :error="loginError" @login="login" />

  <main v-else class="app-shell">
    <nav class="floating-controls" aria-label="Reader controls">
      <button
        class="icon-button"
        type="button"
        :aria-expanded="sessionDrawerOpen"
        aria-controls="session-drawer"
        :aria-label="sessionDrawerOpen ? 'Close streams' : 'Open streams'"
        @click="toggleSessionDrawer"
      >
        <X v-if="sessionDrawerOpen" :size="19" />
        <Menu v-else :size="19" />
      </button>
      <button
        class="icon-button"
        :class="{ active: follow }"
        type="button"
        :aria-pressed="follow"
        :aria-label="follow ? 'Disable subtitle follow' : 'Enable subtitle follow'"
        @click="follow = !follow"
      >
        <LocateFixed :size="18" />
      </button>
      <button
        class="icon-button"
        type="button"
        aria-label="Scroll transcript to top"
        @click="scrollTranscriptTop"
      >
        <ArrowUp :size="18" />
      </button>
    </nav>

    <button
      v-if="sessionDrawerOpen"
      class="drawer-backdrop"
      type="button"
      aria-label="Close streams"
      @click="sessionDrawerOpen = false"
    />

    <div id="session-drawer" class="session-drawer" :class="{ open: sessionDrawerOpen }">
      <SessionRail
        :username="auth.username"
        :sessions="sessions"
        :selected-session-id="selectedSessionId"
        :is-loading="sessionsLoading"
        :error="sessionsError"
        @select="selectSessionAndClose"
        @refresh="refreshSessions"
        @logout="logout"
      />
    </div>

    <ReaderView
      ref="readerView"
      :manifest="manifest"
      :playback-state="playbackState"
      :position-ms="displayPositionMs"
      :cues="currentCues"
      :active-cue-index="activeCueIndex"
      :selected-track-index="selectedTrackIndex"
      :subtitle-loading="subtitleLoading"
      :subtitle-error="subtitleError"
      :follow="follow"
      :selected-cue-indexes="selectedCueIndexList"
      :thumbnail-data-uris="thumbnailDataUris"
      :image-loading-indexes="imageLoadingIndexes"
      :audio-loading-indexes="audioLoadingIndexes"
      @select-track="selectTrack"
      @reload-subtitles="reloadCurrentSubtitles"
      @toggle-cue="toggleCueSelection"
      @request-image="(cueIndex) => void requestImage(cueIndex)"
      @request-audio="(cueIndex) => void requestAndPlayAudio(cueIndex)"
    />

    <SelectionBar
      :selected-count="selectedCueIndexes.size"
      :target-preview="targetCardPreview"
      :loading-target="loadingTargetCard"
      :anki-configured="ankiConfigured"
      :can-send="canSendToAnki"
      :sending="sendingToAnki"
      :image-loading="selectionImageLoading"
      :audio-loading="selectionAudioLoading"
      @settings="showSettings = true"
      @request-image="requestSelectionImage"
      @request-audio="requestSelectionAudio"
      @send-to-anki="sendSelectionToAnki"
      @clear="clearSelection"
    />

    <SettingsModal
      v-if="showSettings"
      :settings="settings"
      @save="saveSettings"
      @cancel="showSettings = false"
    />
  </main>

  <ToastStack :toasts="toasts" @dismiss="dismissToast" />
</template>

<script setup lang="ts">
import { ArrowUp, LocateFixed, Menu, X } from '@lucide/vue';
import { computed, ref, watch } from 'vue';

import LoginPanel from '@/components/LoginPanel.vue';
import ReaderView from '@/components/ReaderView.vue';
import SelectionBar from '@/components/SelectionBar.vue';
import SessionRail from '@/components/SessionRail.vue';
import SettingsModal from '@/components/SettingsModal.vue';
import ToastStack from '@/components/ToastStack.vue';
import { useAnkiMining } from '@/composables/useAnkiMining';
import { useJellyfinPlayback } from '@/composables/useJellyfinPlayback';
import { useMinerSettings } from '@/composables/useMinerSettings';
import { useMiningMedia } from '@/composables/useMiningMedia';
import { useMiningSelection } from '@/composables/useMiningSelection';
import { useSubtitleTracks } from '@/composables/useSubtitleTracks';
import { useToast } from '@/composables/useToast';
import type { MinerSettings } from '@/lib/minerSettings';

const { toasts, toast, dismissToast } = useToast();
const showSettings = ref(false);
const sessionDrawerOpen = ref(true);
const readerView = ref<ReaderViewHandle | null>(null);

type ReaderViewHandle = {
  scrollToTop: () => void;
  scrollToActiveCue: () => void;
};

const {
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
} = useJellyfinPlayback();

const { settings, saveSettings: persistSettings } = useMinerSettings();

const {
  subtitleLoading,
  subtitleError,
  follow,
  currentCues,
  activeCueIndex,
  reloadCurrentSubtitles,
} = useSubtitleTracks({
  apiClient,
  selectedSessionId,
  selectedTrackIndex,
  displayPositionMs,
  logout,
});

const {
  selectedCueIndexes,
  selectedCueIndexList,
  selectedCueCount,
  selectedRange,
  selectedCues,
  toggleCueSelection,
  clearSelection,
} = useMiningSelection(currentCues);

const {
  thumbnailDataUris,
  imageLoadingIndexes,
  audioLoadingIndexes,
  requestImage,
  requestAudio,
  requestAndPlayAudio,
  isMediaLoading,
  clearMedia,
} = useMiningMedia({
  apiClient,
  selectedSessionId,
  selectedTrackIndex,
  currentCues,
  settings,
  toast,
});

const {
  targetCardPreview,
  loadingTargetCard,
  sendingToAnki,
  ankiConfigured,
  canSendToAnki,
  sendSelectionToAnki,
  resetTargetPreview,
} = useAnkiMining({
  settings,
  selectedCueIndexes,
  selectedCueCount,
  selectedRange,
  selectedCues,
  requestAudio,
  requestImage,
  clearSelection,
  toast,
});

const selectionImageLoading = computed(() => {
  const range = selectedRange.value;
  return range ? isMediaLoading('image', range.first, range.last) : false;
});
const selectionAudioLoading = computed(() => {
  const range = selectedRange.value;
  return range ? isMediaLoading('audio', range.first, range.last) : false;
});

watch([selectedSessionId, selectedTrackIndex], () => {
  clearSelection();
  clearMedia();
  resetTargetPreview();
});

watch(auth, (nextAuth) => {
  if (nextAuth) {
    sessionDrawerOpen.value = true;
  }
});

function toggleSessionDrawer(): void {
  sessionDrawerOpen.value = !sessionDrawerOpen.value;
}

function selectSessionAndClose(sessionId: string): void {
  selectSession(sessionId);
  sessionDrawerOpen.value = false;
}

function scrollTranscriptTop(): void {
  follow.value = false;
  readerView.value?.scrollToTop();
}

function requestSelectionImage(): void {
  const range = selectedRange.value;
  if (!range) {
    return;
  }

  void requestImage(range.first, range.last);
}

function requestSelectionAudio(): void {
  const range = selectedRange.value;
  if (!range) {
    return;
  }

  void requestAndPlayAudio(range.first, range.last);
}

function saveSettings(nextSettings: MinerSettings): void {
  persistSettings(nextSettings);
  clearMedia();
  resetTargetPreview();
  showSettings.value = false;
  toast.success('Mining settings saved.');
}
</script>
