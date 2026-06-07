<template>
  <Teleport to="body">
    <div class="modal-overlay" @click.self="emit('cancel')">
      <section
        class="settings-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <header class="modal-header">
          <div>
            <p>Mining</p>
            <h2 id="settings-title">Settings</h2>
          </div>
          <button
            class="icon-button"
            type="button"
            aria-label="Close settings"
            @click="emit('cancel')"
          >
            <X :size="18" />
          </button>
        </header>

        <div class="modal-body">
          <section class="settings-section">
            <div class="section-heading">
              <h3>AnkiConnect</h3>
              <button
                class="secondary-action"
                type="button"
                :disabled="connectionStatus === 'testing'"
                @click="testConnection"
              >
                <LoaderCircle v-if="connectionStatus === 'testing'" class="spin" :size="16" />
                <PlugZap v-else :size="16" />
                <span>{{ connectionStatus === 'testing' ? 'Testing' : 'Test' }}</span>
              </button>
            </div>

            <div class="connection-status" :data-state="connectionStatus">
              <span class="dot" aria-hidden="true"></span>
              <span>{{ connectionLabel }}</span>
            </div>
          </section>

          <section class="settings-section">
            <div class="section-heading">
              <h3>Card fields</h3>
              <button
                class="secondary-action ghost"
                type="button"
                :disabled="connectionStatus !== 'connected'"
                @click="loadModels"
              >
                <RefreshCw :size="16" />
                <span>Reload</span>
              </button>
            </div>

            <div v-if="connectionStatus !== 'connected'" class="settings-empty">
              Connect to AnkiConnect to load note types and fields.
            </div>

            <div v-else class="settings-grid">
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
                <span>Front field</span>
                <select
                  :value="localSettings.anki.frontField"
                  :disabled="!localSettings.anki.noteType"
                  @change="updateAnkiField('frontField', $event)"
                >
                  <option value="">Select...</option>
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
                <span>Audio field</span>
                <select
                  :value="localSettings.anki.audioField"
                  :disabled="!localSettings.anki.noteType"
                  @change="updateAnkiField('audioField', $event)"
                >
                  <option value="">Skip</option>
                  <option v-for="field in availableFields" :key="field" :value="field">
                    {{ field }}
                  </option>
                </select>
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

              <label class="field compact">
                <span>Max card age (minutes)</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  :value="localSettings.anki.maxCardAgeMinutes"
                  @input="updateMaxCardAge"
                />
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
import { LoaderCircle, PlugZap, RefreshCw, RotateCcw, X } from '@lucide/vue';

import { getModelsWithFields, getVersion } from '@/api/ankiConnect';
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
type FieldSetting = 'frontField' | 'sentenceField' | 'audioField' | 'imageField';

const DEFAULT_NOTE_TYPE = 'Lapis';
const DEFAULT_FIELDS: Record<FieldSetting, string> = {
  frontField: 'Expression',
  sentenceField: 'Sentence',
  audioField: 'SentenceAudio',
  imageField: 'Picture',
};

const localSettings = reactive<MinerSettings>({
  anki: { ...props.settings.anki },
  media: { ...props.settings.media },
});
const connectionStatus = ref<ConnectionStatus>('untested');
const connectionError = ref<string | null>(null);
const ankiVersion = ref<number | null>(null);
const modelsWithFields = ref<Record<string, string[]>>({});

const modelNames = computed(() => Object.keys(modelsWithFields.value).sort());
const availableFields = computed(() =>
  localSettings.anki.noteType ? (modelsWithFields.value[localSettings.anki.noteType] ?? []) : [],
);
const settingsValid = computed(() => {
  const anki = localSettings.anki;
  if (!anki.noteType) {
    return true;
  }

  return Boolean(anki.sentenceField || anki.audioField || anki.imageField);
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
  modelsWithFields.value = await getModelsWithFields();
  applyAnkiDefaults();
}

function onModelChange(event: Event): void {
  const noteType = (event.target as HTMLSelectElement).value;
  localSettings.anki = {
    ...localSettings.anki,
    noteType,
    frontField: '',
    sentenceField: '',
    audioField: '',
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

function updateMaxCardAge(event: Event): void {
  const value = Number((event.target as HTMLInputElement).value);
  localSettings.anki = {
    ...localSettings.anki,
    maxCardAgeMinutes: Number.isFinite(value) ? Math.max(0, value) : 0,
  };
}

function resetMedia(): void {
  localSettings.media = { ...defaultMinerSettings.media };
}

function applyAnkiDefaults(): void {
  if (!localSettings.anki.noteType && modelsWithFields.value[DEFAULT_NOTE_TYPE]) {
    localSettings.anki.noteType = DEFAULT_NOTE_TYPE;
  }

  applyFieldDefaults(localSettings.anki.noteType);
}

function applyFieldDefaults(noteType: string): void {
  const fields = modelsWithFields.value[noteType] ?? [];
  for (const [setting, fieldName] of Object.entries(DEFAULT_FIELDS) as Array<
    [FieldSetting, string]
  >) {
    if (!localSettings.anki[setting] && fields.includes(fieldName)) {
      localSettings.anki[setting] = fieldName;
    }
  }
}
</script>
