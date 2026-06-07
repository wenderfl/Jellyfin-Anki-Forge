<template>
  <Teleport to="body">
    <div class="toast-stack">
      <TransitionGroup name="toast">
        <button
          v-for="toastItem in toasts"
          :key="toastItem.id"
          class="toast"
          :data-type="toastItem.type"
          type="button"
          @click="emit('dismiss', toastItem.id)"
        >
          <CircleCheck v-if="toastItem.type === 'success'" :size="18" />
          <CircleAlert v-else-if="toastItem.type === 'error'" :size="18" />
          <TriangleAlert v-else-if="toastItem.type === 'warning'" :size="18" />
          <Info v-else :size="18" />
          <span>{{ toastItem.message }}</span>
          <button
            v-if="toastItem.action"
            class="toast-action"
            type="button"
            @click.stop="toastItem.action.onClick"
          >
            {{ toastItem.action.label }}
          </button>
        </button>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { CircleAlert, CircleCheck, Info, TriangleAlert } from '@lucide/vue';

import type { Toast } from '@/composables/useToast';

defineProps<{
  toasts: readonly Toast[];
}>();

const emit = defineEmits<{
  dismiss: [id: number];
}>();
</script>
