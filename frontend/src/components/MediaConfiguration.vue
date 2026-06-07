<template>
  <div class="media-grid">
    <label class="field compact">
      <span>Audio start offset</span>
      <input
        type="number"
        step="0.05"
        :value="modelValue.audioOffsetStart"
        @input="updateNumber('audioOffsetStart', $event)"
      />
    </label>

    <label class="field compact">
      <span>Audio end offset</span>
      <input
        type="number"
        step="0.05"
        :value="modelValue.audioOffsetEnd"
        @input="updateNumber('audioOffsetEnd', $event)"
      />
    </label>

    <label class="field compact">
      <span>Image format</span>
      <select :value="imageFormatValue" @change="updateImageFormat">
        <option value="jpeg">JPEG</option>
        <option value="webp">WebP still</option>
        <option value="webp_animated">WebP animated</option>
        <option value="avif">AVIF still</option>
        <option value="avif_animated">AVIF animated</option>
      </select>
    </label>

    <label class="field compact">
      <span>Image quality</span>
      <input
        type="number"
        :min="imageQualityBounds.min"
        :max="imageQualityBounds.max"
        :value="modelValue.imageQuality"
        @input="updateNumber('imageQuality', $event)"
      />
    </label>

    <label class="field compact">
      <span>Image size</span>
      <input
        :value="modelValue.imageSize"
        type="text"
        placeholder="640:-2"
        @input="updateText('imageSize', $event)"
      />
    </label>

    <label class="field compact">
      <span>Audio format</span>
      <select :value="modelValue.audioFormat" @change="updateAudioFormat">
        <option value="mp3">MP3</option>
        <option value="opus">Opus</option>
      </select>
    </label>

    <label class="field compact">
      <span>Audio bitrate</span>
      <input
        type="number"
        min="8"
        max="512"
        :value="modelValue.audioQuality"
        @input="updateNumber('audioQuality', $event)"
      />
    </label>

    <label class="field compact">
      <span>Audio filter</span>
      <select :value="modelValue.audioFilterPreset" @change="updateAudioFilter">
        <option value="none">None</option>
        <option value="loudnorm">Loudness normalize</option>
        <option value="dynaudnorm">Dynamic normalize</option>
        <option value="voice_boost">Voice boost</option>
      </select>
    </label>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import type { AudioFilterPreset, AudioFormat, ImageFormat } from '@/api/types';
import type { MediaSettings } from '@/lib/minerSettings';

const props = defineProps<{
  modelValue: MediaSettings;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: MediaSettings];
}>();

const imageFormatValue = computed(() => {
  if (props.modelValue.imageAnimated && props.modelValue.imageFormat === 'webp') {
    return 'webp_animated';
  }

  if (props.modelValue.imageAnimated && props.modelValue.imageFormat === 'avif') {
    return 'avif_animated';
  }

  return props.modelValue.imageFormat;
});

const imageQualityBounds = computed(() => {
  if (props.modelValue.imageFormat === 'jpeg') {
    return { min: 1, max: 31 };
  }

  if (props.modelValue.imageFormat === 'avif') {
    return { min: 0, max: 63 };
  }

  return { min: 0, max: 100 };
});

function patch(value: Partial<MediaSettings>): void {
  emit('update:modelValue', {
    ...props.modelValue,
    ...value,
  });
}

function updateText(field: keyof MediaSettings, event: Event): void {
  patch({ [field]: (event.target as HTMLInputElement).value });
}

function updateNumber(field: keyof MediaSettings, event: Event): void {
  const nextValue = Number((event.target as HTMLInputElement).value);
  patch({ [field]: Number.isFinite(nextValue) ? nextValue : 0 });
}

function updateImageFormat(event: Event): void {
  const value = (event.target as HTMLSelectElement).value;
  if (value === 'webp_animated') {
    patch({ imageFormat: 'webp', imageAnimated: true, imageQuality: 75 });
    return;
  }

  if (value === 'avif_animated') {
    patch({ imageFormat: 'avif', imageAnimated: true, imageQuality: 35 });
    return;
  }

  const imageFormat = value as ImageFormat;
  patch({
    imageFormat,
    imageAnimated: false,
    imageQuality: imageFormat === 'jpeg' ? 5 : imageFormat === 'avif' ? 25 : 80,
  });
}

function updateAudioFormat(event: Event): void {
  patch({ audioFormat: (event.target as HTMLSelectElement).value as AudioFormat });
}

function updateAudioFilter(event: Event): void {
  patch({ audioFilterPreset: (event.target as HTMLSelectElement).value as AudioFilterPreset });
}
</script>
