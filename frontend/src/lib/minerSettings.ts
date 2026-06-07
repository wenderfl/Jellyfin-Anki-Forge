import type { AudioFilterPreset, AudioFormat, ImageFormat } from '@/api/types';

export interface MediaSettings {
  audioOffsetStart: number;
  audioOffsetEnd: number;
  imageFormat: ImageFormat;
  imageQuality: number;
  imageAnimated: boolean;
  imageSize: string;
  audioFormat: AudioFormat;
  audioQuality: number;
  audioFilterPreset: AudioFilterPreset;
}

export interface AnkiSettings {
  noteType: string;
  frontField: string;
  sentenceField: string;
  audioField: string;
  imageField: string;
  maxCardAgeMinutes: number;
}

export interface MinerSettings {
  anki: AnkiSettings;
  media: MediaSettings;
}

export const defaultMinerSettings: MinerSettings = {
  anki: {
    noteType: '',
    frontField: '',
    sentenceField: '',
    audioField: '',
    imageField: '',
    maxCardAgeMinutes: 5,
  },
  media: {
    audioOffsetStart: 0.25,
    audioOffsetEnd: 0.25,
    imageFormat: 'jpeg',
    imageQuality: 5,
    imageAnimated: false,
    imageSize: '640:-2',
    audioFormat: 'mp3',
    audioQuality: 128,
    audioFilterPreset: 'none',
  },
};

const STORAGE_KEY = 'jellyfin-miner.mining-settings';

export function loadMinerSettings(): MinerSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<MinerSettings>;
      return mergeSettings(parsed);
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }

  return mergeSettings({});
}

export function saveMinerSettings(settings: MinerSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function mergeSettings(settings: Partial<MinerSettings>): MinerSettings {
  return {
    anki: {
      ...defaultMinerSettings.anki,
      ...settings.anki,
    },
    media: {
      ...defaultMinerSettings.media,
      ...settings.media,
    },
  };
}
