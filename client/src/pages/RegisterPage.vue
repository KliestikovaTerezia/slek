<template>
  <q-page class="flex flex-center bg-secondary">
    <q-card style="width: 400px; position: relative" flat bordered>
      <q-form @submit="onSubmit" class="q-pa-lg q-gutter-y-md">
        <div class="text-h6 q-mb-lg text-left">Register</div>

        <!-- Avatar + Upload -->
        <div class="profile-wrapper column items-center q-mb-md">
          <ProfilePicture :avatar="uploadedAvatar" size="80px" bgColor="grey-4" />
          <q-btn
            flat
            color="primary"
            class="q-mt-xs text-caption"
            label="add profile picture"
            @click="triggerFileInput"
          />
          <input
            type="file"
            ref="fileInput"
            accept="image/*"
            style="display: none"
            @change="handleFileUpload"
          />
        </div>

        <!-- Polia -->
        <q-input
          v-model.trim="form.firstName"
          label="Name*"
          outlined
          required
          dense
          maxlength="20"
          :rules="[(val) => !!val || '']"
          autofocus
        >
          <template v-slot:before>
            <q-icon name="person" size="20px" class="q-mr-sm" />
          </template>
        </q-input>

        <q-input
          v-model.trim="form.lastName"
          label="Surname*"
          outlined
          required
          dense
          maxlength="30"
          :rules="[(val) => !!val || '']"
        >
          <template v-slot:before>
            <q-icon name="person_outline" size="20px" class="q-mr-sm" />
          </template>
        </q-input>

        <div class="relative-position">
          <q-input
            v-model.trim="form.nickname"
            label="Nickname*"
            outlined
            required
            dense
            maxlength="20"
            :rules="[(val) => !!val || '']"
          >
            <template v-slot:before>
              <q-icon name="person" size="20px" class="q-mr-sm" />
            </template>
          </q-input>
          <div
            v-if="errorMessageNickname"
            class="text-negative text-caption absolute-bottom-left q-pl-sm"
            style="left: 30px"
          >
            {{ errorMessageNickname }}
          </div>
        </div>

        <div class="relative-position">
          <q-input
            v-model.trim="form.email"
            label="Email*"
            type="email"
            outlined
            required
            dense
            maxlength="30"
            :rules="[(val) => !!val || '']"
          >
            <template v-slot:before>
              <q-icon name="mail" size="20px" class="q-mr-sm" />
            </template>
          </q-input>
          <div
            v-if="errorMessageEmail"
            class="text-negative text-caption absolute-bottom-left q-pl-sm"
            style="left: 30px"
          >
            {{ errorMessageEmail }}
          </div>
        </div>

        <q-input
          v-model="form.password"
          label="Password*"
          :type="showPassword ? 'text' : 'password'"
          outlined
          required
          dense
          :rules="[
            (val) => !!val || 'Password is required',
            (val) => val.length >= 8 || 'At least 8 characters',
            (val) => /[0-9]/.test(val) || 'At least one number',
            (val) => /[A-Z]/.test(val) || 'At least one uppercase letter',
            (val) =>
              /[/.?!@#$%^&*()]/.test(val) || 'At least one special character (./?!@#$%^&*())',
          ]"
        >
          <template v-slot:before>
            <q-icon name="lock" size="20px" class="q-mr-sm" />
          </template>
          <template v-slot:append>
            <q-icon
              :name="showPassword ? 'visibility' : 'visibility_off'"
              class="cursor-pointer"
              @click="showPassword = !showPassword"
            />
          </template>
        </q-input>

        <q-input
          v-model="form.passwordConfirmation"
          label="Confirm Password*"
          :type="showPassword ? 'text' : 'password'"
          outlined
          required
          dense
          :error="passwordConfirmation"
          :error-message="''"
        >
          <template v-slot:before>
            <q-icon name="lock_outline" size="20px" class="q-mr-sm" />
          </template>
          <template v-slot:append>
            <q-icon
              :name="showPassword ? 'visibility' : 'visibility_off'"
              class="cursor-pointer"
              @click="showPassword = !showPassword"
            />
          </template>
        </q-input>

        <!-- register btn -->
        <q-btn
          type="submit"
          label="REGISTER"
          color="primary"
          class="full-width bg-yellow-8"
          :loading="loading"
          :disable="loading || passwordConfirmation"
        />
        <div class="text-negative" v-if="errorMessageOther">
          {{ errorMessageOther }}
        </div>

        <!-- prihlasenie -->
        <div class="q-mt-md text-center">
          <span>Already have an account? </span>
          <q-btn flat color="primary" :to="{ name: 'login' }">SIGN IN</q-btn>
        </div>
      </q-form>
    </q-card>
  </q-page>
</template>

<script setup lang="ts">
import { reactive, ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from 'src/stores/auth';
import ProfilePicture from '../components/ProfilePicture.vue';

const router = useRouter();
const authStore = useAuthStore();

const form = reactive({
  firstName: '',
  lastName: '',
  nickname: '',
  email: '',
  password: '',
  passwordConfirmation: '',
});

const showPassword = ref(false);
const uploadedAvatar = ref<string | undefined>(undefined);
const fileInput = ref<HTMLInputElement | null>(null);

const loading = computed(() => authStore.status === 'pending');
const passwordConfirmation = computed(() => {
  return form.passwordConfirmation !== '' && form.passwordConfirmation !== form.password;
});

const triggerFileInput = () => fileInput.value?.click();

const handleFileUpload = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    // zmensime obrazok, inak je request prilis velky (413)
    const img = new Image();
    img.onload = () => {
      const AVATAR_SIZE = 256;
      const scale = Math.min(1, AVATAR_SIZE / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      uploadedAvatar.value = canvas.toDataURL('image/jpeg', 0.85);
    };
    img.src = e.target?.result as string;
  };
  reader.readAsDataURL(file);
};

const errorMessageEmail = ref('');
const errorMessageNickname = ref('');
const errorMessageOther = ref('');
const onSubmit = async () => {
  if (passwordConfirmation.value) return;

  errorMessageEmail.value = '';
  errorMessageNickname.value = '';
  errorMessageOther.value = '';

  const registerData = {
    firstName: form.firstName,
    lastName: form.lastName,
    nickname: form.nickname,
    email: form.email,
    password: form.password,
    passwordConfirmation: form.passwordConfirmation,
    avatar: uploadedAvatar.value,
  };

  try {
    await authStore.register(registerData);
    await router.push({ name: 'login' });
  } catch (err: unknown) {
    console.error('Registration failed:', err);

    if (err && typeof err === 'object' && 'response' in err) {
      const axiosError = err as {
        response?: { data?: { errors?: Array<{ field?: string; message?: string }> } };
      };
      const errors = axiosError.response?.data?.errors;

      if (errors && errors.length > 0) {
        // show vsetky errory naraz
        errors.forEach((error) => {
          if (error.field === 'email') {
            errorMessageEmail.value = 'There is already an account with this email';
          } else if (error.field === 'nickname') {
            errorMessageNickname.value = 'Nickname already exists';
          }
        });

        // ak nemame specificky error, zobrazime defaultny
        if (!errorMessageEmail.value && !errorMessageNickname.value && !errorMessageOther.value) {
          errorMessageOther.value = 'Registration failed';
        }
      } else {
        errorMessageOther.value = 'Registration failed. Please try again.';
      }
    } else {
      errorMessageOther.value = 'Registration failed. Please try again.';
    }
  }
};
</script>

<style scoped>
.profile-wrapper {
  position: absolute;
  top: -40px;
  left: 50%;
  transform: translateX(-50%);
}
</style>
