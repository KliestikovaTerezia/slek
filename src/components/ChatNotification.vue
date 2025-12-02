<!-- <template>
  <transition name="slide">
    <div v-if="show" class="notification-container" @click="closeNotification">
      <q-avatar size="32px" class="q-mr-sm">
        <img :src="senderAvatar" :alt="senderName" />
      </q-avatar>
      <div class="notification-content">
        <div class="notification-header">
          <span class="sender-name">{{ senderName }}</span>
          <q-icon name="close" class="close-icon q-ml-md" size="16px" />
        </div>
        <div class="notification-message">
          {{ truncatedMessage }}
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

interface Props {
  senderName: string;
  senderAvatar?: string;
  message: string;
  duration?: number;
}

const props = withDefaults(defineProps<Props>(), {
  duration: 4000,
  senderAvatar: 'https://cdn.quasar.dev/img/avatar.png',
});

const emit = defineEmits<{
  close: [];
}>();

const show = ref(false);
let timeoutId: NodeJS.Timeout | null = null;

const truncatedMessage = computed(() => {
  if (props.message.length > 10) {
    return props.message.slice(0, 10) + '...';
  }
  return props.message;
});

const showNotification = () => {
  show.value = true;

  // ak je timeout, tak sa vycisti
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
  // setneme novy timeout na zatvaranie
  timeoutId = setTimeout(() => {
    closeNotification();
  }, props.duration);
};

const closeNotification = () => {
  show.value = false;
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
  emit('close');
};

// automaticky sa zobrazi notif pri mountingu
onMounted(() => {
  showNotification();
});

// clear timeout pri unmountingu
onUnmounted(() => {
  if (timeoutId) {
    clearTimeout(timeoutId);
  }
});
</script>

<style scoped>
.notification-container {
  display: flex;
  align-items: center;
  background: #769e89;
  color: white;
  border-radius: 12px;
  padding: 12px 16px;
  margin: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  max-width: 350px;
  transition: all 0.3s ease;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.notification-container:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.notification-content {
  flex: 1;
  min-width: 0;
}

.notification-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.sender-name {
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notification-message {
  font-size: 13px;
  opacity: 0.9;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.close-icon {
  opacity: 0.7;
  transition: opacity 0.2s ease;
}

.close-icon:hover {
  opacity: 1;
}

/* Animácia */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

.slide-enter-to,
.slide-leave-from {
  opacity: 1;
  transform: translateX(0);
}
</style> -->
