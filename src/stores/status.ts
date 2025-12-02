import { defineStore } from 'pinia';
import type { UserStatusType } from 'src/types/UserStatus';
import GlobalSocketService from 'src/services/GlobalService';
import { useAuthStore } from './auth';
import { statusMap } from 'src/types/UserStatus';

export const useStatusStore = defineStore('status', {
  state: () => ({
    myStatus: 'offline' as UserStatusType,
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

      //
      // 1. 🔥 Počúvanie eventov zo servera
      //
      GlobalSocketService.socket.on('status:updated', (newStatus: UserStatusType) => {
        console.log('STATUS EVENT RECEIVED:', newStatus);
        this.myStatus = newStatus;
      });
    },

    //
    // 2. 🔥 Emit na server (funguje cez GlobalService bez namespace)
    //
    updateStatus(newStatus: UserStatusType) {
      const authStore = useAuthStore();
      if (!authStore.user) return;

      // Optimistická aktualizácia UI/store
      this.myStatus = newStatus;
      authStore.user.status = newStatus;

      try {
        console.log('[Store] emitting updateStatus to server with:', newStatus);
        GlobalSocketService.updateStatus(newStatus); // <-- toto je správne
      } catch (err) {
        console.error('Failed to emit updateStatus:', err);
      }
    },
  },
});
