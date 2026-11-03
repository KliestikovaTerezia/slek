<template>
  <router-view v-if="ready" />
  <div v-else class="fullscreen flex flex-center column bg-secondary text-center q-pa-md">
    <q-spinner color="primary" size="48px" />
    <div v-if="slow" class="q-mt-md text-grey-8">
      Waking up the server…<br />
      This can take up to a minute.
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, onBeforeUnmount, ref } from 'vue';
import { useRouter } from 'vue-router';

export default defineComponent({
  name: 'App',

  setup() {
    const router = useRouter();
    const ready = ref(false);
    const slow = ref(false);

    // prva navigacia caka na auth/me, free server sa moze prebudzat aj minutu
    const slowTimer = setTimeout(() => (slow.value = true), 3000);
    void router
      .isReady()
      .catch(() => undefined)
      .finally(() => {
        clearTimeout(slowTimer);
        ready.value = true;
      });

    onBeforeUnmount(() => clearTimeout(slowTimer));

    return { ready, slow };
  },
});
</script>
