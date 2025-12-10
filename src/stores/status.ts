import { defineStore } from 'pinia';
import type { UserStatusType } from 'src/types/UserStatus';
import GlobalSocketService from 'src/services/GlobalService';
import { useAuthStore } from './auth';
import { statusMap } from 'src/types/UserStatus';

export const useStatusStore = defineStore('status', {
  state: () => ({
    myStatus: 'online' as UserStatusType,
    userStatuses: {} as Record<string, UserStatusType>,
    initialized: false,
  }),

  getters: {
    statusObj(state) {
      return statusMap[state.myStatus] || statusMap.offline;
    },
  },

  actions: {
    init() {
      if (this.initialized) return;
      this.initialized = true;

      const authStore = useAuthStore();
      if (authStore.user?.status) {
        this.myStatus = authStore.user.status || 'online';
      }

      // Keď zmenis status ty
      GlobalSocketService.socket.on('status:updated', (newStatus: UserStatusType) => {
        console.log('STATUS EVENT RECEIVED (me):', newStatus);
        this.myStatus = newStatus;
      });

      // Kes zmeni status NIEKTO INY
      GlobalSocketService.socket.on('user:statusUpdated', (payload) => {
        console.log('STATUS EVENT RECEIVED (others):', payload);

        this.updateStatuses(payload);
      });
    },

    updateStatuses(payload: unknown) {
      const list = Array.isArray(payload) ? payload : [payload];

      list.forEach((u) => {
        if (!u.nickname || !u.status) return;
        this.userStatuses[u.nickname] = u.status;
      });

      console.log('ALL statuses:', this.userStatuses);
    },

    //
    // 2. 🔥 Emit na server (funguje cez GlobalService bez namespace)
    //
    // updateStatus(newStatus: UserStatusType) {
    //   const authStore = useAuthStore();
    //   if (!authStore.user) return;

    //   // 1. Zmena stavu lokálne (UI)
    //   this.myStatus = newStatus; // Zmenené z myStatus.value na this.myStatus
    //   // Odstránené: authStore.user.status = newStatus; (už neukladáme do DB)

    //   // 2. Emitovanie na server (EMITUJEME IBA AK NIE SME OFFLINE)
    //   if (newStatus === 'online') {
    //     if (GlobalSocketService.socket.connected) {
    //       console.log('[Store] emitting updateStatus to server with:', newStatus);
    //       GlobalSocketService.updateStatus(newStatus);
    //     }
    //   }
    // },

    setMyStatus(newStatus: UserStatusType) {
      this.myStatus = newStatus;
    },
  },
});
