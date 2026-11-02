<template>
  <!-- Channels zoznam ako pop-up (pre male obrazovky) -->
  <div
    v-if="isSmallScreen && localShowChannels"
    class="channels-overlay bg-yellow-1 q-pa-sm"
    style="width: 250px"
  >
    <q-list bordered>
      <q-item-label header>
        <div class="row items-center">
          <span>Channels</span>
          <q-space />
          <q-btn flat round dense icon="close" @click="localShowChannels = false" />
        </div>
      </q-item-label>

      <!-- Vytvorenie channelu -->
      <q-item clickable :disable="isOffline" @click="emit('openCreateChannelDialog')" class="row">
        <q-item-section>Create Channel</q-item-section>
        <q-item-section avatar>
          <q-icon name="add" color="primary" />
        </q-item-section>
      </q-item>

      <!-- Zoznam channelov -->
      <q-item
        v-for="channel in channels"
        :key="channel.id"
        clickable
        @click="
          emit('selectChannel', channel);
          localShowChannels = false;
        "
        :active="activeChannel?.id === channel.id"
        active-class="bg-primary text-white"
      >
        <q-item-section>
          <div class="row items-center justify-between">
            <span>{{ channel.name }}</span>
            <q-icon v-if="channel.type === 'public'" name="public"></q-icon>
            <q-icon v-else name="lock"></q-icon>
          </div>
        </q-item-section>
      </q-item>
    </q-list>
  </div>

  <!-- Channels panel pre velke obrazovky -->
  <div
    v-else-if="!isSmallScreen && showChannels"
    class="col-auto bg-yellow-1 q-pa-sm"
    style="width: 250px"
  >
    <q-list bordered class="channels-list-scrollable">
      <q-item-label header>
        <div class="row items-center">
          <span>Channels</span>
          <q-space />
          <q-btn flat round dense icon="more_vert">
            <q-menu>
              <q-list style="min-width: 150px">
                <q-item clickable v-close-popup @click="emit('update:channelFilter', 'all')">
                  <q-item-section>All channels</q-item-section>
                </q-item>
                <q-item clickable v-close-popup @click="emit('update:channelFilter', 'public')">
                  <q-item-section>Public channels</q-item-section>
                </q-item>
                <q-item clickable v-close-popup @click="emit('update:channelFilter', 'private')">
                  <q-item-section>Private channels</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </div>
      </q-item-label>

      <!-- Vytvorenie channelu -->
      <q-item clickable :disable="isOffline" @click="emit('openCreateChannelDialog')" class="row">
        <q-item-section>Create Channel</q-item-section>
        <q-item-section avatar>
          <q-icon name="add" color="primary" />
        </q-item-section>
      </q-item>

      <!-- Zoznam channelov -->
      <q-item
        v-for="channel in channels"
        :key="channel.id"
        clickable
        @click="emit('selectChannel', channel)"
        :active="activeChannel?.id === channel.id"
        active-class="bg-primary text-white"
      >
        <q-item-section>
          <div class="row items-center justify-between">
            <span>{{ channel.name }}</span>
            <q-icon v-if="channel.type === 'public'" name="public"></q-icon>
            <q-icon v-else name="lock"></q-icon>
          </div>
        </q-item-section>
      </q-item>
    </q-list>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import type { Channel } from 'src/types/channel';
import { useStatusStore } from 'src/stores/status';

const statusStore = useStatusStore();

const props = defineProps<{
  showChannels: boolean;
  isSmallScreen: boolean;
  channels: Channel[];
  activeChannel: Channel | null;
}>();

const isOffline = computed(() => statusStore.myStatus === 'offline');

const emit = defineEmits<{
  (e: 'update:showChannels', value: boolean): void;
  (e: 'update:channelFilter', value: 'all' | 'public' | 'private'): void;
  (e: 'selectChannel', channel: Channel): void;
  (e: 'openCreateChannelDialog'): void;
}>();

const localShowChannels = ref(false);

watch(
  () => props.showChannels,
  (newVal) => {
    localShowChannels.value = newVal;
  },
);

// emit spat ked sa zatvori drawer
watch(localShowChannels, (newVal) => {
  emit('update:showChannels', newVal);
});

// ked sa meni velkost obrazovky, automaticky zavri drawer
watch(
  () => props.isSmallScreen,
  (isSmall) => {
    if (isSmall) {
      // keď prejde na malú obrazovku -> zavri
      localShowChannels.value = false;
      emit('update:showChannels', false);
    }
  },
);
</script>

<style scoped>
.channel-dialog .q-card {
  max-height: 300px;
  overflow-y: auto;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
}

.typing-indicator {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 4px 4px;
  gap: 3px;
}
.typing-name {
  margin-right: 4px;
}
.dot {
  width: 4px;
  height: 4px;
  background-color: #999;
  border-radius: 50%;
  animation: blink 1.2s infinite ease-in-out;
}
.dot:nth-child(2) {
  animation-delay: 0.2s;
}
.dot:nth-child(3) {
  animation-delay: 0.4s;
}
@keyframes blink {
  0%,
  80%,
  100% {
    opacity: 0.3;
  }
  40% {
    opacity: 1;
  }
}

.channels-overlay {
  position: fixed;
  height: 100vh;
  z-index: 1000;
  overflow-y: auto;
}
.channels-list-scrollable {
  max-height: calc(100vh - 32px);
  overflow-y: auto;
}
</style>
