<template>
  <q-layout view="lHh Rpr lFf">
    <!-- HEADER -->
    <q-header elevated>
      <q-toolbar>
        <q-toolbar-title class="text-left"> Shello </q-toolbar-title>

        <div v-if="isChatPage" class="row items-center q-gutter-sm">
          <div class="q-pa-md text-weight-bold text-body1">{{ userProfile.nickname }}</div>
          <div class="relative-position">
            <q-btn flat dense round aria-label="User" @click="toggleRightDrawer">
              <div class="relative-position">
                <ProfilePicture :avatar="uploadedAvatar" size="33px" bgColor="grey-4" />
                <div
                  class="status-indicator q-ml-sm"
                  :style="{ backgroundColor: myStatusObj.color }"
                ></div>
              </div>
            </q-btn>
            <q-badge v-if="notifications.length > 0" color="red" floating transparent>
              {{ notifications.length }}
            </q-badge>
          </div>

          <!-- LOGOUT BUTTON -->
          <q-btn color="dark" flat>
            <q-icon name="logout" class="q-mr-xs"></q-icon>
            Log out
            <q-menu
              v-model="showLogoutMenu"
              anchor="bottom right"
              self="top right"
              :offset="[0, 16]"
            >
              <q-card style="min-width: 200px">
                <q-card-section class="text-center"> Do you want to log out? </q-card-section>
                <q-card-actions align="right">
                  <q-btn flat label="Cancel" color="black" v-close-popup />
                  <q-btn color="primary" label="Log out" @click="confirmLogout" />
                </q-card-actions>
              </q-card>
            </q-menu>
          </q-btn>
        </div>
      </q-toolbar>
    </q-header>

    <!-- SIDE MENU -->
    <q-drawer side="right" v-model="rightDrawerOpen" bordered overlay :width="drawerWidth">
      <q-item class="row items-center justify-between">
        <q-item-label header>User Menu</q-item-label>
        <q-btn flat icon="close" size="sm" @click="rightDrawerOpen = false" />
      </q-item>

      <q-list>
        <q-expansion-item
          :model-value="profileExpanded"
          @update:model-value="toggleProfile"
          :label="`${userProfile.firstName} ${userProfile.lastName}`"
          header-class="text-dark"
        >
          <template v-slot:header>
            <q-item-section avatar>
              <div class="relative-position">
                <ProfilePicture :avatar="uploadedAvatar" size="40px" bgColor="grey-4" />
                <div
                  class="status-indicator q-ml-sm"
                  :style="{ backgroundColor: myStatusObj.color }"
                ></div>
              </div>
            </q-item-section>
            <q-item-section>
              {{ userProfile.firstName }} {{ userProfile.lastName }}
            </q-item-section>
          </template>

          <q-card flat class="q-pa-md">
            <q-card-section>
              <div>
                <strong>Name:</strong> {{ userProfile.firstName }} {{ userProfile.lastName }}
              </div>
              <div><strong>Nickname:</strong> {{ userProfile.nickname }}</div>
              <div><strong>Email:</strong> {{ userProfile.email }}</div>

              <div class="row justify-end q-mt-md">
                <q-btn flat color="primary" label="Edit Profile" @click="editProfile" />
              </div>
            </q-card-section>
          </q-card>
        </q-expansion-item>

        <q-item clickable @click.stop="openSettingsMenu" class="text-dark">
          <q-item-section avatar class="q-pl-sm">
            <q-icon name="settings" />
          </q-item-section>
          <q-item-section>
            <q-item-label>Settings</q-item-label>
            <q-item-label caption>Account preferences</q-item-label>
          </q-item-section>
        </q-item>

        <q-menu
          v-model="settingsMenuVisible"
          anchor="bottom middle"
          self="top middle"
          :offset="[0, 8]"
        >
          <q-list style="min-width: 150px">
            <q-item clickable v-close-popup @click="showStatusDialog = true">
              <q-item-section>Statuses</q-item-section>
            </q-item>
          </q-list>

          <q-item>
            <q-item-section>
              <q-toggle
                v-model="notificationsEnabled"
                label="Enable notifications"
                @update:model-value="askForNotificationPermission"
              />
              <q-toggle
                v-model="notifyOnlyWhenTagged"
                label="Notify only when tagged"
                @update:model-value="handleNotifyToggle"
              >
                <q-tooltip>Receive notifications only when mentioned or tagged</q-tooltip>
              </q-toggle>
            </q-item-section>
          </q-item>
        </q-menu>

        <q-item v-if="notifications.length > 0">
          <q-item-section>
            <div class="notification-message row items-center justify-between">
              <span>{{ notifications[0]?.message }}</span>
              <q-btn flat dense round icon="close" size="xs" @click="dismissNotification" />
            </div>
          </q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <!-- STATUS DIALOG -->
    <q-dialog v-model="showStatusDialog">
      <q-card style="min-width: 300px">
        <q-card-section>
          <div class="text-h6">Set your status</div>
          <q-select
            v-model="myStatus"
            :options="[
              { label: 'Online', value: 'online' },
              // { label: 'Do Not Disturb', value: 'dnd' },
              { label: 'Offline', value: 'offline' },
            ]"
            label="Status"
            emit-value
          />
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat color="primary" label="Save" v-close-popup @click="updateStatus" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useQuasar } from 'quasar';
import ProfilePicture from '../components/ProfilePicture.vue';
import { authManager } from 'src/services';
import { api } from 'src/boot/axios';
import { useAuthStore } from 'src/stores/auth';
import { statusMap } from 'src/types/UserStatus';
import GlobalSocketService from 'src/services/GlobalService';
import NotificationService from 'src/services/NotificationService';
import { useStatusStore } from 'src/stores/status';
import { SocketManager } from 'src/services/SocketManager';

const statusStore = useStatusStore();
statusStore.init();

const myStatus = computed({
  get: () => statusStore.myStatus,
  set: (value) => {
    // 1. Lokálna aktualizácia (Pinia store) - TERAZ JE SPRÁVNE
    statusStore.setMyStatus(value);
  },
});

const askForNotificationPermission = async () => {
  const granted = await NotificationService.requestPermission();
  if (!granted) {
    console.warn('Notifications not allowed by user');
  }
};

const notificationsEnabled = ref(false);

const authStore = useAuthStore();
const $q = useQuasar();
const router = useRouter();
const route = useRoute();

// const initialStatusFromStore = authStore.user?.status;
const myStatusObj = computed(() => {
  const statusKey = myStatus.value;
  return statusMap[statusKey] || statusMap.offline;
});

function updateStatus() {
  // Ak je status 'online', setter to detekuje a zavolá GlobalSocketService.connect()
  // Ak je status 'offline', setter to detekuje a zavolá GlobalSocketService.disconnect()

  // Všetko riadi setter, takže stačí zavrieť dialóg.
  console.log('[UI] Final status set via dialog:', myStatus.value);
  showStatusDialog.value = false;

  // Dôležité: Ak by ste chceli, aby sa status EMITOVAL na server aj po uložení
  // (napr. pre prípad, že bol status už online a vy len potvrdzujete),
  // musíte tu pridať:
  // if (myStatus.value === 'online' && GlobalSocketService.socket.connected) {
  //   statusStore.updateStatus('online'); // Emitujeme 'online' (ak sme už pripojení)
  // }    // 2. 🚨 RIADENIE PRIPOJENIA (logika ostáva rovnaká)
  if (myStatus.value === 'offline') {
    console.log('[Socket Control] Status set to Offline. Disconnecting socket.');
    //odpoji vsetky osobitne kanaly okrem root
    SocketManager.destroyAllInstances('/');
    //teraz root
    GlobalSocketService.socket.disconnect();
  } else if (myStatus.value === 'online') {
    if (!GlobalSocketService.socket.connected) {
      console.log('[Socket Control] Status set to Online. Connecting socket.');
      GlobalSocketService.socket.connect();
    } else {
      // Ak sme už pripojení, emitujeme 'online'
      statusStore.updateStatus('online');
    }
  }
  showStatusDialog.value = false;
}

// RESPONSIVE DRAWER
const drawerWidth = computed(() => ($q.screen.xs ? $q.screen.width : 350));

function dismissNotification() {
  notifications.value.shift();
}

const uploadedAvatar = computed(() => {
  return authStore.user?.avatar || undefined;
});
const userProfile = computed(() => {
  if (!authStore.user)
    return {
      firstName: 'Guest',
      lastName: '',
      nickname: 'Guest',
      email: '',
      avatar: null,
      status: myStatus.value,
    };

  return {
    id: authStore.user.id,
    firstName: authStore.user.firstName,
    lastName: authStore.user.lastName,
    nickname: authStore.user.nickname,
    email: authStore.user.email,
    avatar: authStore.user.avatar,
    status: myStatus.value, // <-- tu len berieme môj lokálny status
  };
});

// ked je tag zapnuty
const notifyOnlyWhenTagged = computed({
  get: () => authStore.settings?.notifyOnlyMentions ?? false,
  set: (value: boolean) => {
    authStore.saveSettings({ notifyOnlyMentions: value });
  },
});

function handleNotifyToggle(value: boolean) {
  console.log('Notify only when tagged:', value);
}

//DO NOT DISTURB

// SHOW ELEMENTS ONLY ON CHAT PAGE
const isChatPage = computed(() => route.path === '/channels');

// NOTIFICATIONS
const notifications = ref([{ message: 'This channel has been inactive for 30 days...' }]);

// MENU STATES
const rightDrawerOpen = ref(false);
const showLogoutMenu = ref(false);
const profileExpanded = ref(false);
const settingsMenuVisible = ref(false);
const showStatusDialog = ref(false);

// ACTIONS
function toggleRightDrawer() {
  rightDrawerOpen.value = !rightDrawerOpen.value;
}

function toggleProfile(v: boolean) {
  profileExpanded.value = v;
  settingsMenuVisible.value = false;
}

function openSettingsMenu() {
  settingsMenuVisible.value = !settingsMenuVisible.value;
}

function editProfile() {}

async function confirmLogout() {
  showLogoutMenu.value = false;

  try {
    await api.post('/auth/logout', {});
  } catch (error) {
    console.error('Logout API call failed:', error);
  }
  authManager.logout();
  await router.push({ name: 'login' });
}
</script>

<style scoped>
.notification-message {
  background-color: #f44336;
  padding: 8px;
  border-radius: 4px;
}
.text-dark {
  color: #424242 !important;
}
.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid white;
  position: absolute;
  bottom: 0;
  right: 0;
  z-index: 1;
}
</style>
