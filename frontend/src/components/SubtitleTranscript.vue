<template>
  <div ref="transcriptShell" class="transcript-shell">
    <div v-if="cues.length === 0" class="transcript-empty">
      <CaptionsOff :size="34" />
      <h2>No subtitle cues</h2>
      <p>The selected track has no readable cues.</p>
    </div>

    <ol v-else class="transcript-list" aria-label="Subtitle transcript">
      <li
        v-for="(cue, index) in cues"
        :key="cue.Index"
        :ref="(element) => captureCue(element, cue.Index, index === activeCueIndex)"
        class="cue-row"
        :class="{
          active: index === activeCueIndex,
          past: cue.EndMs < positionMs,
          selected: selectedCueIndexes.includes(cue.Index),
        }"
        @click="emit('toggleCue', cue.Index)"
      >
        <span class="cue-time">{{ formatDuration(cue.StartMs) }}</span>
        <div class="cue-content">
          <div class="cue-main">
            <p>{{ cue.Text }}</p>
            <div class="cue-actions">
              <button
                class="icon-button small"
                type="button"
                :disabled="imageLoadingIndexes.includes(cue.Index)"
                aria-label="Generate cue screenshot"
                @click.stop="emit('requestImage', cue.Index)"
              >
                <LoaderCircle
                  v-if="imageLoadingIndexes.includes(cue.Index)"
                  class="spin"
                  :size="16"
                />
                <ImageIcon v-else :size="16" />
              </button>
              <button
                class="icon-button small"
                type="button"
                :disabled="audioLoadingIndexes.includes(cue.Index)"
                aria-label="Generate cue audio"
                @click.stop="emit('requestAudio', cue.Index)"
              >
                <LoaderCircle
                  v-if="audioLoadingIndexes.includes(cue.Index)"
                  class="spin"
                  :size="16"
                />
                <Volume2 v-else :size="16" />
              </button>
            </div>
          </div>
          <img
            v-if="thumbnailDataUris[cue.Index]"
            class="cue-thumbnail"
            :src="thumbnailDataUris[cue.Index]"
            alt=""
          />
        </div>
      </li>
    </ol>
  </div>
</template>

<script setup lang="ts">
import { nextTick, shallowRef, watch } from 'vue';
import type { ComponentPublicInstance } from 'vue';
import { CaptionsOff, Image as ImageIcon, LoaderCircle, Volume2 } from '@lucide/vue';

import type { SubtitleCue } from '@/api/types';
import { formatDuration } from '@/lib/playback';

const props = defineProps<{
  cues: readonly SubtitleCue[];
  activeCueIndex: number;
  positionMs: number;
  follow: boolean;
  selectedCueIndexes: readonly number[];
  thumbnailDataUris: Readonly<Record<number, string>>;
  imageLoadingIndexes: readonly number[];
  audioLoadingIndexes: readonly number[];
}>();

const emit = defineEmits<{
  toggleCue: [cueIndex: number];
  requestImage: [cueIndex: number];
  requestAudio: [cueIndex: number];
}>();

const activeCueElement = shallowRef<HTMLElement | null>(null);
const transcriptShell = shallowRef<HTMLElement | null>(null);
const cueElements = new Map<number, HTMLElement>();

watch(
  () => [props.activeCueIndex, props.follow] as const,
  async () => {
    if (!props.follow) {
      return;
    }

    await scrollToActiveCue();
  },
);

function captureCue(
  element: Element | ComponentPublicInstance | null,
  cueIndex: number,
  isActive: boolean,
): void {
  if (!(element instanceof HTMLElement)) {
    cueElements.delete(cueIndex);
    if (isActive) {
      activeCueElement.value = null;
    }

    return;
  }

  cueElements.set(cueIndex, element);
  if (isActive) {
    activeCueElement.value = element;
  }
}

function scrollToTop(): void {
  transcriptShell.value?.scrollTo({
    top: 0,
    behavior: 'smooth',
  });

  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  });
}

async function scrollToActiveCue(): Promise<void> {
  const targetCueIndex = scrollTargetCueIndex();
  if (targetCueIndex == null) {
    return;
  }

  await nextTick();
  const targetElement = cueElements.get(targetCueIndex) ?? activeCueElement.value;
  targetElement?.scrollIntoView({
    block: 'center',
    behavior: 'smooth',
  });
}

function scrollTargetCueIndex(): number | null {
  const activeCue = props.cues[props.activeCueIndex];
  if (activeCue) {
    return activeCue.Index;
  }

  let low = 0;
  let high = props.cues.length - 1;
  let previousCueIndex: number | null = null;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const cue = props.cues[middle];
    if (!cue) {
      break;
    }

    if (cue.StartMs <= props.positionMs) {
      previousCueIndex = cue.Index;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return previousCueIndex ?? props.cues[0]?.Index ?? null;
}

defineExpose({
  scrollToTop,
  scrollToActiveCue,
});
</script>
