// app/Controllers/Ws/UserController.ts
import type { WsContextContract } from "@ioc:Ruby184/Socket.IO/WsContext";
import User from 'App/Models/User'
import { UserStatusType } from 'contracts/status' 

export default class UserController {
  public async updateStatus({ socket }: WsContextContract, payload: { status: UserStatusType }) {
    console.log('[WS] updateStatus called with payload:', payload);

    if (!socket.data.userId) {
      console.log('[WS] User not authenticated');
      return socket.emit('status:updated', { success: false, error: 'User not authenticated' });
    }

    try {
      const user = await User.find(socket.data.userId);
      console.log('[WS] Found user:', user?.id);

      if (!user) {
        console.log('[WS] No user found for id:', socket.data.userId);
        return;
      }

      const newStatus: UserStatusType = payload.status;
      console.log('[WS] Setting new status:', newStatus);

      user.status = newStatus;
      await user.save();

      console.log('[WS] Status saved to DB:', user.status);

      // Broadcast ostatným
      socket.broadcast.emit('user:statusUpdated', { userId: user.id, status: user.status });
      console.log('[WS] Broadcasted statusUpdated');

      // Potvrdenie pre odosielateľa
      socket.emit('status:updated', { success: true, status: user.status });
      console.log('[WS] Emitted status:updated to sender');

    } catch (err) {
      console.error('[WS] Error updating status:', err);
      socket.emit('status:updated', { success: false, error: err.message });
    }
  }
}


