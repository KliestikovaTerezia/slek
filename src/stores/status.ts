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
        if (this.myStatus === 'online') {
          console.log('STATUS EVENT RECEIVED (others):', payload);
          this.userStatuses[payload.nickname] = payload.status;
        }
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

    setMyStatus(newStatus: UserStatusType) {
      this.myStatus = newStatus;
    },
  },
});
