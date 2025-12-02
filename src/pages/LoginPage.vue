<template>
  <q-page class="flex flex-center bg-secondary">
    <q-card style="width: 400px" flat bordered>
      <q-card-section class="q-pa-lg">
        <div class="text-h6 q-mb-lg">Log in</div>

        <q-form @submit.prevent="onSubmit" class="q-gutter-y-md">
          <!-- EMAIL -->
          <q-input
            v-model.trim="credentials.email"
            label="Email*"
            type="email"
            outlined
            required
            dense
            maxlength="30"
            autofocus
            class="q-mb-md"
            :rules="[
              (val) => !!val || 'Email is required',
              (val) => /.+@.+\..+/.test(val) || 'Enter a valid email',
            ]"
          >
            <template v-slot:prepend>
              <q-icon name="mail" size="20px" class="q-mr-sm" />
            </template>
          </q-input>

          <!-- PASSWORD -->
          <q-input
            v-model="credentials.password"
            :type="isPwdVisible ? 'text' : 'password'"
            label="Password*"
            outlined
            required
            dense
            class="q-mb-md"
            :rules="[
              (val) => !!val || 'Password is required',
              (val) => val.length >= 8 || 'At least 8 characters',
              (val) => /[0-9]/.test(val) || 'At least one number',
              (val) => /[A-Z]/.test(val) || 'At least one uppercase letter',
              (val) =>
                /[./?!@#$%^&*()]/.test(val) || 'At least one special character (/.?!@#$%^&*())',
            ]"
          >
            <template v-slot:prepend>
              <q-icon name="lock" size="20px" class="q-mr-sm" />
            </template>
            <template v-slot:append>
              <q-icon
                :name="isPwdVisible ? 'visibility' : 'visibility_off'"
                class="cursor-pointer"
                @click="isPwdVisible = !isPwdVisible"
              />
            </template>
          </q-input>

          <div>
            <span class="forgot-link" @click="onForgotPassword">Forgot password?</span>
          </div>

          <q-btn
            type="submit"
            label="Log in"
            color="primary"
            class="full-width bg-yellow-8"
            :loading="loading"
          />
        </q-form>
        <div
          class="text-negative q-mb-md"
          style="height: 24px"
          :class="{ 'opacity-0': !errorMessage }"
        >
          {{ errorMessage }}
        </div>

        <div class="q-mt-md text-center">
          <span>Don't have an account yet? </span>
          <q-btn flat color="primary" @click="goToRegister">Sign up</q-btn>
        </div>
      </q-card-section>
    </q-card>
  </q-page>
</template>

<script setup lang="ts">
import { reactive, ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuthStore } from 'src/stores/auth';
// import NotificationService from 'src/services/NotificationService';

// Pinia store
const authStore = useAuthStore();

// Router
const router = useRouter();
const route = useRoute();

// Form data
const credentials = reactive({
  email: '',
  password: '',
  remember: false,
});

const isPwdVisible = ref(false);

// Loading state from Pinia
const loading = computed(() => authStore.status === 'pending');

// Redirect after login
const redirectTo = computed(() => {
  return (route.query.redirect as string) || { name: 'home' };
});

// Navigation helpers
const goToRegister = () => {
  void router.push({ name: 'register' });
};

const onForgotPassword = () => {
  console.log('Forgot password clicked — page not implemented yet');
};

// const askForNotificationPermission = async () => {
//   const granted = await NotificationService.requestPermission();
//   if (!granted) {
//     console.warn('Notifications not allowed by user');
//   }
// };

const errorMessage = ref('');
const onSubmit = async () => {
  try {
    await authStore.login(credentials);

    // await askForNotificationPermission();

    await router.push(redirectTo.value);
  } catch (err: unknown) {
    if (err instanceof Error) {
      console.error('Login failed:', err.message);
      errorMessage.value = 'Invalid email or password';
      // tu môžeš zobraziť err.message vo notify alebo UI
    } else {
      console.error('Login failed with unknown error', err);
      errorMessage.value = 'Unknown error occurred';
    }
  }
};
</script>

<style scoped>
.material-symbols-outlined {
  font-variation-settings:
    'FILL' 0,
    'wght' 400,
    'GRAD' 0,
    'opsz' 48;
}

.forgot-link {
  color: var(--q-primary);
  cursor: pointer;
  text-decoration: underline;
  font-size: 14px;
}
.forgot-link:hover {
  opacity: 0.8;
}
</style>
