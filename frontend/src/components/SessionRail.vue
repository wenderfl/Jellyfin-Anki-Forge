<template>
  <aside class="session-rail">
    <header class="rail-header">
      <div>
        <p>{{ username }}</p>
        <h2>Streams</h2>
      </div>
      <div class="rail-actions">
        <button
          class="icon-button"
          type="button"
          aria-label="Refresh streams"
          @click="emit('refresh')"
        >
          <RefreshCw :size="18" />
        </button>
        <button class="icon-button" type="button" aria-label="Sign out" @click="emit('logout')">
          <LogOut :size="18" />
        </button>
      </div>
    </header>

    <div v-if="isLoading && sessions.length === 0" class="rail-empty">
      <LoaderCircle class="spin" :size="20" />
      <span>Loading streams</span>
    </div>

    <div v-else-if="error" class="rail-empty error">
      <CircleAlert :size="20" />
      <span>{{ error }}</span>
    </div>

    <div v-else-if="sessions.length === 0" class="rail-empty">
      <MonitorPlay :size="22" />
      <span>No active streams</span>
    </div>

    <div v-else class="session-list" role="list">
      <button
        v-for="session in sessions"
        :key="session.SessionId"
        class="session-card"
        :class="{
          selected: session.SessionId === selectedSessionId,
          stale: isSessionStale(session),
        }"
        type="button"
        role="listitem"
        :aria-pressed="session.SessionId === selectedSessionId"
        @click="emit('select', session.SessionId)"
      >
        <span class="session-status" :class="statusClass(session)">
          <PauseCircle v-if="session.IsPaused" :size="14" />
          <Radio v-else :size="14" />
          {{ statusLabel(session) }}
        </span>

        <span class="session-title">{{ session.ItemName || 'Untitled media' }}</span>
        <span class="session-device">{{ session.Client }} on {{ session.DeviceName }}</span>

        <span class="session-meta">
          <span>{{ formatDuration(session.PositionMs) }}</span>
          <span v-if="session.ActiveSubtitleStreamIndex != null">
            Sub {{ session.ActiveSubtitleStreamIndex }}
          </span>
        </span>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import {
  CircleAlert,
  LoaderCircle,
  LogOut,
  MonitorPlay,
  PauseCircle,
  Radio,
  RefreshCw,
} from '@lucide/vue';

import type { SessionSummary } from '@/api/types';
import { formatDuration, isSessionStale } from '@/lib/playback';

defineProps<{
  username: string;
  sessions: readonly SessionSummary[];
  selectedSessionId: string | null;
  isLoading: boolean;
  error: string | null;
}>();

const emit = defineEmits<{
  select: [sessionId: string];
  refresh: [];
  logout: [];
}>();

function statusClass(session: SessionSummary): string {
  if (isSessionStale(session)) {
    return 'stale';
  }

  return session.IsPaused ? 'paused' : 'live';
}

function statusLabel(session: SessionSummary): string {
  if (isSessionStale(session)) {
    return 'Stale';
  }

  return session.IsPaused ? 'Paused' : 'Live';
}
</script>
