<template>
  <main class="login-page">
    <form class="login-panel" @submit.prevent="submit">
      <header>
        <h1>Jellyfin Miner</h1>
      </header>

      <label class="field">
        <span>Username</span>
        <span class="field-shell">
          <User :size="18" />
          <input v-model.trim="form.username" autocomplete="username" required />
        </span>
      </label>

      <label class="field">
        <span>Password</span>
        <span class="field-shell">
          <LockKeyhole :size="18" />
          <input
            v-model="form.password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            required
          />
          <button
            class="icon-button ghost"
            type="button"
            :aria-label="showPassword ? 'Hide password' : 'Show password'"
            @click="showPassword = !showPassword"
          >
            <EyeOff v-if="showPassword" :size="18" />
            <Eye v-else :size="18" />
          </button>
        </span>
      </label>

      <label class="remember-row">
        <input v-model="form.remember" type="checkbox" />
        <span>Remember me</span>
      </label>

      <p v-if="error" class="form-error" role="alert">{{ error }}</p>

      <button class="primary-action" type="submit" :disabled="isLoading">
        <LoaderCircle v-if="isLoading" class="spin" :size="18" />
        <LogIn v-else :size="18" />
        <span>{{ isLoading ? 'Signing in' : 'Sign in' }}</span>
      </button>
    </form>
  </main>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { Eye, EyeOff, LoaderCircle, LockKeyhole, LogIn, User } from '@lucide/vue';

import type { LoginPayload } from '@/api/types';

defineProps<{
  isLoading: boolean;
  error: string | null;
}>();

const emit = defineEmits<{
  login: [payload: LoginPayload];
}>();

const showPassword = ref(false);
const form = reactive<LoginPayload>({
  username: '',
  password: '',
  remember: true,
});

function submit(): void {
  emit('login', { ...form });
}
</script>
