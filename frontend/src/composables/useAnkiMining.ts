import { computed, ref, type ComputedRef, type Ref } from 'vue';

import type { MediaResponse, SubtitleCue } from '@/api/types';
import type { ToastApi } from '@/composables/useToast';
import type { MinerSettings } from '@/lib/minerSettings';
import { addNote, guiBrowse, type AnkiMedia } from '@/api/ankiConnect';

interface CueRange {
  first: number;
  last: number;
}

export interface UseAnkiMiningOptions {
  settings: Ref<MinerSettings>;
  selectedCueIndexes: Ref<Set<number>>;
  selectedCueCount: ComputedRef<number>;
  selectedRange: ComputedRef<CueRange | null>;
  selectedCues: ComputedRef<readonly SubtitleCue[]>;
  sourceContext: ComputedRef<string | null>;
  requestAudio: (cueIndex: number, endCueIndex?: number) => Promise<MediaResponse | null>;
  requestImage: (cueIndex: number, endCueIndex?: number) => Promise<MediaResponse | null>;
  clearSelection: () => void;
  toast: ToastApi;
}

export function useAnkiMining(options: UseAnkiMiningOptions) {
  const sendingToAnki = ref(false);

  const ankiConfigured = computed(() => {
    const anki = options.settings.value.anki;
    return Boolean(
      anki.deckName &&
      anki.noteType &&
      (anki.sentenceField || (anki.audioFields && anki.audioFields.length > 0) || anki.imageField)
    );
  });

  const canSendToAnki = computed(
    () => options.selectedCueIndexes.value.size > 0 && ankiConfigured.value
  );

  async function sendSelectionToAnki(): Promise<void> {
    const range = options.selectedRange.value;
    if (!range || options.selectedCues.value.length === 0 || !ankiConfigured.value) {
      options.toast.warning('Configure Anki fields before sending.');
      return;
    }

    sendingToAnki.value = true;
    try {
      const updates: Record<string, string> = {};
      const selectedText = options.selectedCues.value.map((cue) => cue.Text).join(' ');
      const anki = options.settings.value.anki;

      if (anki.sentenceField) {
        updates[anki.sentenceField] = selectedText;
      }

      const audioMedia: AnkiMedia[] = [];
      const pictureMedia: AnkiMedia[] = [];

      if (anki.audioFields && anki.audioFields.length > 0) {
        const audio = await options.requestAudio(range.first, range.last);
        if (!audio) {
          return;
        }

        audioMedia.push({
          filename: audio.FileNameHint,
          data: audio.DataBase64,
          fields: [...anki.audioFields]
        });
      }

      if (anki.imageField) {
        const image = await options.requestImage(range.first, range.last);
        if (!image) {
          return;
        }

        pictureMedia.push({
          filename: image.FileNameHint,
          data: image.DataBase64,
          fields: [anki.imageField]
        });
      }

      if (anki.sourceField && options.sourceContext.value) {
        updates[anki.sourceField] = options.sourceContext.value;
      }

      if (Object.keys(updates).length === 0 && audioMedia.length === 0 && pictureMedia.length === 0) {
        throw new Error('No Anki fields are configured for updates.');
      }

      const noteId = await addNote(anki.deckName, anki.noteType, updates, audioMedia, pictureMedia);
      options.toast.success(`Created new Anki card with ${options.selectedCues.value.length} subtitle cue(s).`, {
        action: {
          label: 'Browse',
          onClick: () => {
            void guiBrowse(`nid:${noteId}`);
          },
        },
      });
      window.setTimeout(options.clearSelection, 1_500);
    } catch (error) {
      options.toast.error(error instanceof Error ? error.message : 'Unable to update Anki.');
    } finally {
      sendingToAnki.value = false;
    }
  }

  return {
    sendingToAnki,
    ankiConfigured,
    canSendToAnki,
    sendSelectionToAnki,
  };
}


