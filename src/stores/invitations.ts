// src/stores/invitations.ts
import { defineStore } from 'pinia';
import type { Invitation } from 'src/types/invitation';
import GlobalSocketService from 'src/services/GlobalService';
import channelService from 'src/services/ChannelService';
import { useChannelsStore } from 'src/stores/channels';

export const useInvitationsStore = defineStore('invitations', {
  state: () => ({
    list: [] as Invitation[],
  }),

  getters: {
    count: (state) => state.list.length,
  },

  actions: {
    add(inv: Invitation) {
      if (!this.list.some((i) => i.id === inv.id)) {
        this.list.push(inv);
      }
    },
    remove(id: number) {
      this.list = this.list.filter((i) => i.id !== id);
    },
    async loadInitial() {
      const loaded = await GlobalSocketService.loadInitialInvitations();
      this.list = loaded;
    },
    async accept(invitation: Invitation) {
      try {
        //TOTO ma topovat channel ale nejde to!
        const socket = channelService.join(invitation.channelName);
        if (!socket.isJoined) {
          await socket.joinChannel();
        }
        await socket.acceptInvitation(invitation.id);

        const channelsStore = useChannelsStore();
        await channelsStore.fetchChannels(); // refresh zoznamu

        const channelToTop = channelsStore.channelsList.find((c) => c.id === invitation.channelId);

        if (channelToTop) {
          // 2. ✅ Odstráňte ho z aktuálnej pozície
          channelsStore.removeChannelById(channelToTop.id);

          // 3. ✅ Topnite ho
          channelsStore.channelsList.unshift(channelToTop);
          channelsStore.setActive(channelToTop.name);
        }

        this.remove(invitation.id);
      } catch (err) {
        console.error('Failed to accept invitation:', err);
      }
    },
    async decline(invitation: Invitation) {
      try {
        const socket = channelService.join(invitation.channelName);
        await socket.declineInvitation(invitation.id);
        this.remove(invitation.id);
      } catch (err) {
        console.error('Failed to decline invitation:', err);
      }
    },
  },
});
