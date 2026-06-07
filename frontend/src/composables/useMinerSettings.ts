import { ref, watch } from 'vue';

import type { MinerSettings } from '@/lib/minerSettings';
import { loadMinerSettings, saveMinerSettings } from '@/lib/minerSettings';

export function useMinerSettings() {
  const settings = ref<MinerSettings>(loadMinerSettings());

  watch(
    settings,
    (nextSettings) => {
      saveMinerSettings(nextSettings);
    },
    { deep: true },
  );

  function saveSettings(nextSettings: MinerSettings): void {
    settings.value = {
      anki: { ...nextSettings.anki },
      media: { ...nextSettings.media },
    };
  }

  return {
    settings,
    saveSettings,
  };
}
