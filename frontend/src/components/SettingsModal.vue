<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="emit('cancel')">
      <section class="modal settings-modal" role="dialog" aria-modal="true" aria-label="Settings">
        <header class="modal-header">
          <h2>Mining settings</h2>
          <button class="icon-button" type="button" aria-label="Close" @click="emit('cancel')">
            <X :size="20" />
          </button>
        </header>

        <div class="modal-body">
          <section class="settings-section">
            <div class="section-heading">
              <h3>Anki Connect</h3>
              <button
                class="secondary-action ghost"
                type="button"
                :class="{ testing: connectionStatus === 'testing' }"
                :disabled="connectionStatus === 'testing'"
                @click="testConnection"
              >
                <RefreshCw v-if="connectionStatus === 'testing'" class="spin" :size="16" />
                <PlugZap v-else :size="16" />
                <span>Test</span>
              </button>
            </div>
            <div
              class="connection-status"
              :class="{
                error: connectionStatus === 'error',
                success: connectionStatus === 'connected',
              }"
            >
              {{ connectionLabel }}
            </div>
            <div v-if="connectionStatus === 'connected'" class="anki-settings">
              <label class="field compact">
                <span>Deck</span>
                <select
                  :value="localSettings.anki.deckName"
                  @change="updateAnkiField('deckName', $event)"
                >
                  <option value="">Select...</option>
                  <option v-for="deck in deckNames" :key="deck" :value="deck">
                    {{ deck }}
                  </option>
                </select>
              </label>

              <label class="field compact">
                <span>Note type</span>
                <select :value="localSettings.anki.noteType" @change="onModelChange">
                  <option value="">Select...</option>
                  <option v-for="model in modelNames" :key="model" :value="model">
                    {{ model }}
                  </option>
                </select>
              </label>

              <label class="field compact">
                <span>Source field</span>
                <select
                  :value="localSettings.anki.sourceField"
                  :disabled="!localSettings.anki.noteType"
                  @change="updateAnkiField('sourceField', $event)"
                >
                  <option value="">Skip</option>
                  <option v-for="field in availableFields" :key="field" :value="field">
                    {{ field }}
                  </option>
                </select>
              </label>

              <label class="field compact">
                <span>Sentence field</span>
                <select
                  :value="localSettings.anki.sentenceField"
                  :disabled="!localSettings.anki.noteType"
                  @change="updateAnkiField('sentenceField', $event)"
                >
                  <option value="">Skip</option>
                  <option v-for="field in availableFields" :key="field" :value="field">
                    {{ field }}
                  </option>
                </select>
              </label>

              <label class="field compact">
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                  <span>Audio fields</span>
                  <button 
                    type="button" 
                    class="secondary-action ghost" 
                    style="padding: 2px 6px; font-size: 11px; height: auto;"
                    :disabled="!localSettings.anki.noteType"
                    @click="selectAllAudioFields"
                  >
                    Select All
                  </button>
                </div>
                <select
                  multiple
                  :value="localSettings.anki.audioFields"
                  :disabled="!localSettings.anki.noteType"
                  @change="updateAnkiMultiField('audioFields', $event)"
                  size="3"
                >
                  <option v-for="field in availableFields" :key="field" :value="field">
                    {{ field }}
                  </option>
                </select>
                <small class="hint">Hold Ctrl/Cmd to select multiple</small>
              </label>

              <label class="field compact">
                <span>Image field</span>
                <select
                  :value="localSettings.anki.imageField"
                  :disabled="!localSettings.anki.noteType"
                  @change="updateAnkiField('imageField', $event)"
                >
                  <option value="">Skip</option>
                  <option v-for="field in availableFields" :key="field" :value="field">
                    {{ field }}
                  </option>
                </select>
              </label>
            </div>
          </section>

          <section class="settings-section">
            <div class="section-heading">
              <h3>Media</h3>
              <button class="secondary-action ghost" type="button" @click="resetMedia">
                <RotateCcw :size="16" />
                <span>Reset</span>
              </button>
            </div>
            <MediaConfiguration v-model="localSettings.media" />
          </section>
        </div>

        <footer class="modal-footer">
          <button class="secondary-action ghost" type="button" @click="emit('cancel')">
            Cancel
          </button>
          <button
            class="primary-action modal-save"
            type="button"
            :disabled="!settingsValid"
            @click="emit('save', localSettings)"
          >
            Save
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { PlugZap, RefreshCw, RotateCcw, X } from '@lucide/vue';

import { getModelsWithFields, getVersion, getDeckNames } from '@/api/ankiConnect';
import type { AnkiSettings, MinerSettings } from '@/lib/minerSettings';
import { defaultMinerSettings } from '@/lib/minerSettings';

import MediaConfiguration from './MediaConfiguration.vue';

const props = defineProps<{
  settings: MinerSettings;
}>();

const emit = defineEmits<{
  save: [settings: MinerSettings];
  cancel: [];
}>();

type ConnectionStatus = 'untested' | 'testing' | 'connected' | 'error';
type FieldSetting = 'sourceField' | 'sentenceField' | 'imageField';

const DEFAULT_NOTE_TYPE = 'Lapis';
const DEFAULT_FIELDS: Record<FieldSetting, string> = {
  sourceField: '',
  sentenceField: 'Sentence',
  imageField: 'Picture',
};
const DEFAULT_AUDIO_FIELDS = ['SentenceAudio'];

const localSettings = reactive<MinerSettings>({
  anki: { ...props.settings.anki },
  media: { ...props.settings.media },
});
const connectionStatus = ref<ConnectionStatus>('untested');
const connectionError = ref<string | null>(null);
const ankiVersion = ref<number | null>(null);
const modelsWithFields = ref<Record<string, string[]>>({});
const deckNames = ref<string[]>([]);

const modelNames = computed(() => Object.keys(modelsWithFields.value).sort());
const availableFields = computed(() =>
  localSettings.anki.noteType ? (modelsWithFields.value[localSettings.anki.noteType] ?? []) : [],
);

const settingsValid = computed(() => {
  const anki = localSettings.anki;
  if (!anki.noteType || !anki.deckName) {
    return false;
  }

  return Boolean(anki.sentenceField || (anki.audioFields && anki.audioFields.length > 0) || anki.imageField);
});

const connectionLabel = computed(() => {
  if (connectionStatus.value === 'connected') {
    return `Connected to AnkiConnect v${ankiVersion.value}`;
  }

  if (connectionStatus.value === 'error') {
    return connectionError.value ?? 'Unable to connect';
  }

  if (connectionStatus.value === 'testing') {
    return 'Testing AnkiConnect on 127.0.0.1:8765';
  }

  return 'Not tested';
});

async function testConnection(): Promise<void> {
  connectionStatus.value = 'testing';
  connectionError.value = null;
  try {
    ankiVersion.value = await getVersion();
    connectionStatus.value = 'connected';
    await loadModels();
  } catch (error) {
    connectionStatus.value = 'error';
    connectionError.value = error instanceof Error ? error.message : 'Unable to connect';
  }
}

async function loadModels(): Promise<void> {
  const [fetchedModels, fetchedDecks] = await Promise.all([
    getModelsWithFields(),
    getDeckNames(),
  ]);
  modelsWithFields.value = fetchedModels;
  deckNames.value = fetchedDecks.sort();
  applyAnkiDefaults();
}

function onModelChange(event: Event): void {
  const noteType = (event.target as HTMLSelectElement).value;
  localSettings.anki = {
    ...localSettings.anki,
    noteType,
    sourceField: '',
    sentenceField: '',
    audioFields: [],
    imageField: '',
  };
  applyFieldDefaults(noteType);
}

function updateAnkiField(field: keyof AnkiSettings, event: Event): void {
  localSettings.anki = {
    ...localSettings.anki,
    [field]: (event.target as HTMLSelectElement).value,
  };
}

function updateAnkiMultiField(field: keyof AnkiSettings, event: Event): void {
  const select = event.target as HTMLSelectElement;
  const values = Array.from(select.selectedOptions).map(opt => opt.value);
  localSettings.anki = {
    ...localSettings.anki,
    [field]: values,
  };
}

function selectAllAudioFields(): void {
  if (!localSettings.anki.noteType) return;
  localSettings.anki.audioFields = [...availableFields.value];
}

function resetMedia(): void {
  localSettings.media = { ...defaultMinerSettings.media };
}

function applyAnkiDefaults(): void {
  if (!localSettings.anki.noteType && modelsWithFields.value[DEFAULT_NOTE_TYPE]) {
    localSettings.anki.noteType = DEFAULT_NOTE_TYPE;
  }

  if (!localSettings.anki.deckName && deckNames.value.includes('Default')) {
    localSettings.anki.deckName = 'Default';
  }

  applyFieldDefaults(localSettings.anki.noteType);
}

function applyFieldDefaults(noteType: string): void {
  const fields = modelsWithFields.value[noteType] ?? [];
  for (const [setting, fieldName] of Object.entries(DEFAULT_FIELDS) as Array<
    [FieldSetting, string]
  >) {
    if (fieldName && !(localSettings.anki as any)[setting] && fields.includes(fieldName)) {
      (localSettings.anki as any)[setting] = fieldName;
    }
  }
  
  if (localSettings.anki.audioFields.length === 0) {
    const defaultAudio = DEFAULT_AUDIO_FIELDS.filter(f => fields.includes(f));
    if (defaultAudio.length > 0) {
      localSettings.anki.audioFields = defaultAudio;
    }
  }
}
</script>



<style scoped>
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 36px;
  height: 20px;
}
.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--line);
  transition: .2s;
  border-radius: 20px;
}
.slider:before {
  position: absolute;
  content: "";
  height: 14px;
  width: 14px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: .2s;
  border-radius: 50%;
}
input:checked + .slider {
  background-color: var(--teal);
}
@media (max-width: 800px) {
  input:checked + .slider {
    background-color: var(--accent);
  }
}
input:checked + .slider:before {
  transform: translateX(16px);
}
input:disabled + .slider {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
