import { computed, ref, watch, type ComputedRef, type Ref } from 'vue';

import type { MediaResponse, SubtitleCue } from '@/api/types';
import type { ToastApi } from '@/composables/useToast';
import { preserveHtmlTags } from '@/lib/htmlTags';
import type { MinerSettings } from '@/lib/minerSettings';
import {
  getLastNote,
  guiBrowse,
  storeMediaFile,
  updateNoteFields,
  type NoteInfo,
} from '@/api/ankiConnect';

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
  requestAudio: (cueIndex: number, endCueIndex?: number) => Promise<MediaResponse | null>;
  requestImage: (cueIndex: number, endCueIndex?: number) => Promise<MediaResponse | null>;
  clearSelection: () => void;
  toast: ToastApi;
}

export function useAnkiMining(options: UseAnkiMiningOptions) {
  const targetCardPreview = ref<string | null>(null);
  const loadingTargetCard = ref(false);
  const sendingToAnki = ref(false);
  let previewRequestId = 0;

  const ankiConfigured = computed(() => {
    const anki = options.settings.value.anki;
    return Boolean(anki.noteType && (anki.sentenceField || anki.audioField || anki.imageField));
  });
  const canSendToAnki = computed(
    () =>
      options.selectedCueIndexes.value.size > 0 &&
      ankiConfigured.value &&
      Boolean(targetCardPreview.value),
  );

  watch(
    [
      options.selectedCueCount,
      () => options.settings.value.anki.noteType,
      () => options.settings.value.anki.frontField,
      () => options.settings.value.anki.maxCardAgeMinutes,
    ],
    () => {
      void updateTargetCardPreview();
    },
    { immediate: true },
  );

  async function sendSelectionToAnki(): Promise<void> {
    const range = options.selectedRange.value;
    if (!range || options.selectedCues.value.length === 0 || !ankiConfigured.value) {
      options.toast.warning('Configure Anki fields before sending.');
      return;
    }

    sendingToAnki.value = true;
    try {
      const note = await getLastNote(options.settings.value.anki.noteType);
      if (!note) {
        throw new Error('No recent Anki note found.');
      }

      const maxAgeMinutes = options.settings.value.anki.maxCardAgeMinutes;
      if (maxAgeMinutes > 0 && Date.now() - note.noteId > maxAgeMinutes * 60_000) {
        throw new Error(`Latest Anki note is older than ${maxAgeMinutes} minutes.`);
      }

      const updates: Record<string, string> = {};
      const selectedText = options.selectedCues.value.map((cue) => cue.Text).join(' ');
      const anki = options.settings.value.anki;

      if (anki.sentenceField) {
        updates[anki.sentenceField] = preserveHtmlTags(
          note.fields[anki.sentenceField]?.value ?? '',
          selectedText,
        );
      }

      if (anki.audioField) {
        const audio = await options.requestAudio(range.first, range.last);
        if (audio) {
          const storedFilename = await storeMediaFile(audio.FileNameHint, audio.DataBase64);
          updates[anki.audioField] = `[sound:${storedFilename || audio.FileNameHint}]`;
        }
      }

      if (anki.imageField) {
        const image = await options.requestImage(range.first, range.last);
        if (image) {
          const storedFilename = await storeMediaFile(image.FileNameHint, image.DataBase64);
          updates[anki.imageField] = `<img src="${storedFilename || image.FileNameHint}">`;
        }
      }

      if (Object.keys(updates).length === 0) {
        throw new Error('No Anki fields are configured for updates.');
      }

      await updateNoteFields(note.noteId, updates);
      options.toast.success(`Added ${options.selectedCues.value.length} subtitle cue(s) to Anki.`, {
        action: {
          label: 'Browse',
          onClick: () => {
            void guiBrowse(`nid:${note.noteId}`);
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

  async function updateTargetCardPreview(): Promise<void> {
    const requestId = ++previewRequestId;
    if (options.selectedCueIndexes.value.size === 0 || !ankiConfigured.value) {
      targetCardPreview.value = null;
      loadingTargetCard.value = false;
      return;
    }

    loadingTargetCard.value = true;
    try {
      const note = await getLastNote(options.settings.value.anki.noteType);
      if (requestId !== previewRequestId) {
        return;
      }

      targetCardPreview.value = note
        ? buildTargetCardPreview(note, options.settings.value.anki.frontField)
        : null;
    } catch {
      if (requestId === previewRequestId) {
        targetCardPreview.value = null;
      }
    } finally {
      if (requestId === previewRequestId) {
        loadingTargetCard.value = false;
      }
    }
  }

  function resetTargetPreview(): void {
    previewRequestId += 1;
    targetCardPreview.value = null;
    loadingTargetCard.value = false;
  }

  return {
    targetCardPreview,
    loadingTargetCard,
    sendingToAnki,
    ankiConfigured,
    canSendToAnki,
    sendSelectionToAnki,
    updateTargetCardPreview,
    resetTargetPreview,
  };
}

function buildTargetCardPreview(note: NoteInfo, frontField: string): string {
  const rawPreview =
    (frontField ? note.fields[frontField]?.value : undefined) ??
    Object.values(note.fields).find((field) => field.value)?.value ??
    `Note ${note.noteId}`;
  const stripped = rawPreview.replace(/<[^>]*>/g, '').trim();
  return stripped.length > 54 ? `${stripped.slice(0, 54)}...` : stripped;
}
