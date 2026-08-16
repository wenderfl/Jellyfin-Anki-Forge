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
  deckName: string;
  noteType: string;
  sourceField: string;
  sentenceField: string;
  audioFields: string[];
  imageField: string;
}

export interface MinerSettings {
  anki: AnkiSettings;
  media: MediaSettings;
}

export const defaultMinerSettings: MinerSettings = {
  anki: {
    deckName: '',
    noteType: '',
    sourceField: '',
    sentenceField: '',
    audioFields: [],
    imageField: '',
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

function mergeSettings(settings: any): MinerSettings {
  const anki = {
    ...defaultMinerSettings.anki,
    ...(settings.anki || {}),
  };

  if (settings.anki && typeof settings.anki.audioField === 'string' && settings.anki.audioField !== '') {
    anki.audioFields = [settings.anki.audioField];
    delete anki.audioField;
  } else if (!anki.audioFields) {
    anki.audioFields = [];
  }

  return {
    anki,
    media: {
      ...defaultMinerSettings.media,
      ...(settings.media || {}),
    },
  };
}
