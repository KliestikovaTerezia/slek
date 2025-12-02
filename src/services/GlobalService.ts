// src/services/GlobalSocketService.ts
import { SocketManager } from './SocketManager';
import { useChannelsStore } from 'src/stores/channels';
import type { Invitation, InvitationWithUserId } from 'src/types/invitation';
import { useAuthStore } from 'src/stores/auth';
import { type UserStatusType } from 'src/types/UserStatus';

class GlobalSocketService extends SocketManager {
  private subscribed = false;
  private invitations: Invitation[] = [];

  constructor() {
    super('/'); // Root namespace
    this.socket.connect();
  }

  public boot(): this {
    this.subscribe();
    if (!this.socket.connected) {
      console.log('[GlobalService] connecting socket...');
      this.socket.connect();
    }
    return this;
  }

  // 1️⃣ Emit na server – user zmenil svoj status
  public updateStatus(newStatus: UserStatusType): void {
    console.log('HelOOOOOOOOO');
    try {
      console.log('[Service] emitting updateStatus to server with:', newStatus);
      this.socket.emit('updateStatus', {
        status: newStatus,
        userId: useAuthStore().user?.id,
      });
    } catch (err) {
      console.error('Failed to emit updateStatus:', err);
    }
  }

  // 2️⃣ Prijímanie eventov z backendu
  public onStatusUpdated(
    callback: (data: { userId: string | number; status: UserStatusType }) => void,
  ): void {
    this.socket.off('user:statusUpdated'); // zrušíme predchádzajúce listener-y
    this.socket.on('user:statusUpdated', callback);
  }

  public subscribe(): void {
    if (this.subscribed) {
      console.log('Already subscribed to global socket');
      return;
    }
    this.socket.on('connect', () => {
      console.log('Global socket CONNECTED');

      const authStore = useAuthStore();
      const token = authStore.token; // make sure you store JWT in authStore after login!

      if (!token) {
        console.error('No token found for socket auth');
        return;
      }

      // Send Bearer token (this is what Adonis expects)
      this.socket.emit('auth', {
        token: token.startsWith('Bearer ') ? token : `Bearer ${token}`,
      });

      console.log('[GlobalService] Authenticated socket with Bearer token');
    });

    // Listen for invitations
    this.socket.on('invitation:received', (data: InvitationWithUserId) => {
      const authStore = useAuthStore();
      if (!authStore.user) {
        console.warn('Invitation received but user not logged in yet');
        return;
      }

      if (data.userId !== authStore.user?.id) return;

      const { ...invitation } = data;
      this.invitations.push(invitation);

      window.dispatchEvent(new CustomEvent('invitation:received', { detail: invitation }));
    });

    // Listen for user removed event
    this.socket.on(
      'user:removed',
      (data: { userId: number; channelId: number; channelName: string; removedBy: string }) => {
        const authStore = useAuthStore();

        if (data.userId === authStore.user?.id) {
          window.dispatchEvent(new CustomEvent('user:removed', { detail: data }));
        }
      },
    );

    this.subscribed = true;
    console.log('Subscribed to global socket');
  }

  public async getInvitations(): Promise<Invitation[]> {
    return this.emitAsync<Invitation[]>('getInvitations');
  }

  public removeInvitation(id: number): void {
    this.invitations = this.invitations.filter((inv) => inv.id !== id);
  }

  public async loadInitialInvitations(): Promise<Invitation[]> {
    try {
      // Load from any channel socket (they all share the same backend)
      const channelStore = useChannelsStore();
      if (channelStore.channelsList.length > 0) {
        const firstChannel = channelStore.channelsList[0];
        const channelService = (await import('./ChannelService')).default;
        const socket = channelService.in(firstChannel.name);

        if (socket) {
          this.invitations = await socket.getInvitations();
          return this.invitations;
        }
      }
      return [];
    } catch (err) {
      console.error('Failed to load invitations:', err);
      return [];
    }
  }
}

export default new GlobalSocketService();
