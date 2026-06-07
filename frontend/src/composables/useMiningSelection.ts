import { computed, ref, type ComputedRef } from 'vue';

import type { SubtitleCue } from '@/api/types';

export function useMiningSelection(currentCues: ComputedRef<readonly SubtitleCue[]>) {
  const selectedCueIndexes = ref<Set<number>>(new Set());
  const selectedCueIndexList = computed(() => [...selectedCueIndexes.value].sort((a, b) => a - b));
  const selectedCueCount = computed(() => selectedCueIndexes.value.size);
  const selectedRange = computed(() => getSelectionBounds(selectedCueIndexes.value));
  const selectedCues = computed(() =>
    currentCues.value.filter((cue) => selectedCueIndexes.value.has(cue.Index)),
  );

  function toggleCueSelection(cueIndex: number): void {
    selectedCueIndexes.value = toggleContiguousSelection(selectedCueIndexes.value, cueIndex);
  }

  function clearSelection(): void {
    selectedCueIndexes.value = new Set();
  }

  return {
    selectedCueIndexes,
    selectedCueIndexList,
    selectedCueCount,
    selectedRange,
    selectedCues,
    toggleCueSelection,
    clearSelection,
  };
}

function toggleContiguousSelection(
  selectedIndexes: ReadonlySet<number>,
  cueIndex: number,
): Set<number> {
  const next = new Set(selectedIndexes);
  const bounds = getSelectionBounds(next);

  if (next.has(cueIndex)) {
    if (!bounds || cueIndex === bounds.first || cueIndex === bounds.last) {
      next.delete(cueIndex);
    }
  } else if (
    next.size === 0 ||
    !bounds ||
    cueIndex === bounds.first - 1 ||
    cueIndex === bounds.last + 1
  ) {
    next.add(cueIndex);
  }

  return next;
}

function getSelectionBounds(
  selectedIndexes: ReadonlySet<number>,
): { first: number; last: number } | null {
  let first = Number.POSITIVE_INFINITY;
  let last = Number.NEGATIVE_INFINITY;
  for (const index of selectedIndexes) {
    first = Math.min(first, index);
    last = Math.max(last, index);
  }

  return selectedIndexes.size === 0 ? null : { first, last };
}
