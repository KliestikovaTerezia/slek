import type { WsContextContract } from "@ioc:Ruby184/Socket.IO/WsContext";
import type { MessageRepositoryContract } from "@ioc:Repositories/MessageRepository";
import { inject } from "@adonisjs/core/build/standalone";
import Channel from "App/Models/Channel";
import User from "App/Models/User";
import ChannelInvitation from "App/Models/ChannelInvitation";
import type { InvitationPayload } from "contracts/invitation";
import ChannelBan from "App/Models/ChannelBan";

export const userStatuses: Record<number, "online" | "offline" > = {};
const userDndStatuses: Record<number, boolean> = {};

@inject(["Repositories/MessageRepository"])
export default class MessageController {
  constructor(private messageRepository: MessageRepositoryContract) {}
  public async joinChannel({ params, auth, socket }: WsContextContract) {
    const channelName = params.name;
    const user = auth.user!;
    const userId = user.id;
    // const userNickname = user.displayName || user.email.split("@")[0];
    // const userAvatar = user.avatarUrl || "";

    // 1. Nájdi alebo vytvor kanál
    let channel = await Channel.firstOrCreate(
      { name: channelName },
      {
        name: channelName,
        type: "public",
        createdBy: userId,
      }
    );

    // 2. Načítaj členov
    await channel.load("members");

    // 3. Skontroluj, či už bol členom
    const wasAlreadyMember = channel.members.some((m) => m.id === userId);

    // 4. Ak nie je člen → pridaj ho
    if (!wasAlreadyMember) {
      await channel.related("members").attach([userId]);
      await channel.load("members"); // znova načítaj po attach
    }

    // 5. Pripoj socket do roomu
    socket.join(channelName);

    // 6. ✅ EMIT members:update pre VŠETKÝCH (aj nového člena)
    const updatedMembersList = channel.members.map((m) => ({
      id: m.id,
      name: m.displayName || m.nickname || m.email.split("@")[0],
      avatar: m.avatarUrl || "",
    }));

    // ✅ Pošli VŠETKÝM v kanáli (vrátane toho, kto sa práve pridal)
    socket.nsp.to(channelName).emit("members:update", {
      channelId: channel.id,
      members: updatedMembersList,
    });

    // ✅ ODSTRÁŇ member:joined event - nie je potrebný!
    // members:update už obsahuje všetkých členov
    // if (!wasAlreadyMember) { ... } // <-- VYMAŽ CELÝ TENTO BLOK

    console.log(`USER JOINED: ${user.email} → #${channelName} (admin: ${channel.createdBy === userId})`);

    // 7. Vráť info pre frontend
    return {
      success: true,
      channel: channelName,
      channelId: channel.id,
      isAdmin: channel.createdBy === userId,
    };
  }
  // public async joinChannel({ params, auth, socket }: WsContextContract) {
  //   const channelName = params.name;
  //   const user = auth.user!;
  //   const userId = user.id;
  //   const userNickname = user.displayName || user.email.split("@")[0];
  //   const userAvatar = user.avatarUrl || "";

  //   // 1. Nájdi alebo vytvor kanál
  //   let channel = await Channel.firstOrCreate(
  //     { name: channelName },
  //     {
  //       name: channelName,
  //       type: "public",
  //       createdBy: userId,
  //     }
  //   );

  //   // 2. Načítaj členov
  //   await channel.load("members");

  //   // 3. Skontroluj, či už bol členom
  //   const wasAlreadyMember = channel.members.some((m) => m.id === userId);

  //   // 4. Ak nie je člen → pridaj ho
  //   if (!wasAlreadyMember) {
  //     await channel.related("members").attach([userId]);
  //     // Emit fresh members list to everyone in the channel
  //     await channel.load("members"); // znova načítaj po attach
  //     const updatedMembersList = channel.members.map((m) => ({
  //       id: m.id,
  //       name: m.displayName || m.nickname || m.email.split("@")[0],
  //       avatar: m.avatarUrl || "",
  //     }));

  //     socket.nsp.to(channelName).emit("members:update", {
  //       channelId: channel.id,
  //       members: updatedMembersList,
  //     });
  //   }

  //   // 5. Pripoj socket do roomu (používame len channelName ako room)
  //   socket.join(channelName);

  //   // 6. Pošli aktuálny zoznam členov iba novopripojenému
  //   const membersList = channel.members.map((m) => ({
  //     id: m.id,
  //     name: m.displayName || m.nickname || m.email.split("@")[0],
  //     avatar: m.avatarUrl || "",
  //   }));

  //   socket.emit("members:list", membersList);

  //   // 7. Ak je to NOVÝ člen → oznám všetkým (vrátane seba)
  //   if (!wasAlreadyMember) {
  //     const joinPayload = {
  //       userId,
  //       nickname: userNickname,
  //       avatar: userAvatar,
  //       channelName,
  //       channelId: channel.id,
  //       isAdmin: channel.createdBy === userId,
  //     };

  //     // Broadcast všetkým v kanáli (vrátane odosielateľa)
  //     socket.to(channelName).emit("member:joined", joinPayload);
  //   }

  //   console.log(`USER JOINED: ${user.email} → #${channelName} (admin: ${channel.createdBy === userId})`);

  //   // 8. Vráť info pre frontend (napr. isAdmin)
  //   return {
  //     success: true,
  //     channel: channelName,
  //     channelId: channel.id,
  //     isAdmin: channel.createdBy === userId,
  //   };
  // }

  public async loadMessages({ params, auth }: WsContextContract) {
    const channelName = params.name;
    const userId = auth.user!.id;

    const channel = await Channel.query()
      .where("name", channelName)
      .whereHas("members", (q) => q.where("users.id", userId))
      .first();

    if (!channel) {
      throw new Error("You are not a member of this channel");
    }

    return this.messageRepository.getAll(channelName);
  }

  public async addMessage(
    { params, socket, auth }: WsContextContract,
    content: string
  ) {
    const channelName = params.name;
    const userId = auth.user!.id;

    // Over, či je členom
    const channel = await Channel.query()
      .where("name", channelName)
      .whereHas("members", (q) => q.where("users.id", userId))
      .firstOrFail();

    // Zabezpeč, že je v roome
    socket.join(channelName);

    // Vytvor správu
    const message = await this.messageRepository.create(channelName, userId, content);

    // Pošli všetkým v kanáli
    socket.nsp.to(channelName).emit("message", message);

    return message;
  }

  // NOVÁ METÓDA: leaveChannel
  // public async leaveChannel({ socket, params, auth }: WsContextContract) {
  //   const channelName = params.name;
  //   const user = auth.user!;

  //   const channel = await Channel.findByOrFail("name", channelName);
    
  //   await channel.related("members").detach([user.id]);
  //   await channel.load("members");

  //   const updatedMembersList = channel.members.map((m) => ({
  //     id: m.id,
  //     name: m.displayName || m.nickname || m.email.split("@")[0],
  //     avatar: m.avatarUrl || "",
  //   }));

  //   socket.nsp.to(channelName).emit("members:update", {
  //     channelId: channel.id,
  //     members: updatedMembersList,
  //   });

  //   // ✅ POTOM emit member:left
  //   socket.nsp.to(channelName).emit("member:left", {
  //     userId: user.id,
  //     nickname: user.displayName || user.email.split("@")[0],
  //     avatar: user.avatarUrl || "",
  //     channelName,
  //   });

  //   // disconnect socket
  //   // socket.leave(channelName);
    
  //   console.log(`USER LEFT via socket: ${user.email} → #${channelName}`);
    
  //   return { success: true };   

  // }
  public async deleteChannel({ auth, socket }: WsContextContract, channelId: number) {
    const user = auth.user!
    const channel = await Channel.findOrFail(channelId)

    if (channel.createdBy !== user.id) {
      throw new Error('Only channel creator can delete it')
    }

    const channelName = channel.name

    await channel.delete()

    // Pošli VŠETKÝM v roomke (vrátane admina!)
    socket.nsp.emit('channel:deleted', {
      channelId: channel.id,
      channelName,
      deletedBy: user.displayName || user.nickname,
    })
    console.log('Ano delete prebehol.')
    const Ws = (await import('@ioc:Ruby184/Socket.IO/Ws')).default
    // Globálny refresh pre tých, čo nie sú v roomke
    Ws.io.emit('allChannels:updated')

    return { message: `Channel "${channelName}" deleted` }
  }

//dnd
public async updateDnd(
  { auth }: WsContextContract,
  payload: { dnd: boolean }
) {
  const user = auth.user!;
  user.dnd = payload.dnd;
  await user.save();
  
  // Save DND status separately
  userDndStatuses[user.id] = payload.dnd;
  console.log('[Server] updateDnd called for user:', user.email, 'payload:', payload);

  const Ws = (await import('@ioc:Ruby184/Socket.IO/Ws')).default;

  // Broadcast DND update to everyone
  Ws.io.emit('user:dndUpdated', {
    userId: user.id,
    dnd: payload.dnd,
    nickname: user.displayName || user.nickname,
    avatar: user.avatarUrl,
  });

  console.log(`[Server] USER DND UPDATED: ${user.email} → ${payload.dnd}`);

  return { success: true, dnd: payload.dnd };
}

public async getAllDnds({}: WsContextContract) {
  const users = await User.query().select('nickname', 'dnd');
  
  return users.map(u => ({
    nickname: u.nickname,
    dnd: u.dnd
  }));
}
  
public async updateStatus(
  { auth, socket }: WsContextContract,
  payload: { status: "online" | "offline"; userId?: number } // type môže byť objekt
) {
  const user = auth.user!;
  userStatuses[user.id] = payload.status;
  console.log('[Server] updateStatus called for user:', user.email, 'payload:', payload);

  const Ws = (await import('@ioc:Ruby184/Socket.IO/Ws')).default;
  
  Ws.io.emit("user:statusUpdated", {
    userId: user.id,
    status: payload.status,
    nickname: user.displayName || user.nickname,
    avatar: user.avatarUrl,
  });

  console.log(`[Server] USER STATUS UPDATED: ${user.email} → ${payload.status}`);

  return { success: true, status: payload.status };
}

public async getAllStatuses({ auth }: WsContextContract) {
  const userIds = Object.keys(userStatuses).map(Number);

  // načítaj všetkých používateľov z DB podľa ID
  const users = await User.query().whereIn('id', userIds);

  const statuses = users.map(u => ({
    userId: u.id,
    status: userStatuses[u.id], // tu je len status
    nickname: u.displayName || u.nickname || u.email.split('@')[0],
    avatar: u.avatarUrl,
  }));

  return statuses;
}

//typing
public async userTyping(
  { auth, socket }: WsContextContract,
  payload: { typing: boolean; text?: string }  // <-- include text
) {
  const user = auth.user!;
  const channelName = socket.nsp.name.split('/').pop();

  console.log(
    `[Server] User ${user.email} is ${payload.typing ? 'typing' : 'stopped typing'} in #${channelName}`,
    ',text:', payload.text
  );

  // Broadcast to all other clients in the channel
  socket.broadcast.to(channelName!).emit('user:typing', {
    userId: user.id,
    nickname: user.displayName || user.nickname || user.email.split('@')[0],
    avatar: user.avatarUrl || "",
    typing: payload.typing,
    text: payload.text,  // <-- forward the typed text
  });
  //nepotrebujeme return
}

/**
 * Kontrola banu pre používateľa v danom kanáli.
 */
public async checkBanStatus({ auth }: WsContextContract, channelName: string) {
    const userId = auth.user!.id;

    const channel = await Channel.query().where('name', channelName).first();

    if (!channel) {
        // Kanál neexistuje, čo by sa nemalo stať, ak sa frontend pýta správne,
        // ale pre istotu vrátime 'not_found'.
        return { status: 'not_found' }; 
    }

    const isBanned = await ChannelBan.query()
        .where('channel_id', channel.id)
        .where('user_id', userId)
        .first();

    if (isBanned) {
        return { 
            status: 'banned', 
            message: `You are banned from channel "${channelName}"`
        };
    }

    // Všetko v poriadku, môže sa pripojiť
    return { status: 'ok' };
}

  public async leaveChannel({ socket, params, auth }: WsContextContract) {
    const channelName = params.name;
    const user = auth.user!;
    const userId = user.id;

    const channel = await Channel.findByOrFail("name", channelName);
    await channel.load("members");

    if (!channel.members.some(m => m.id === userId)) {
      return { success: true };
    }

    await channel.related("members").detach([userId]);
    await channel.load("members");

    console.log(`USER LEFT: ${user.email} → #${channelName}`);

    const updatedMembersList = channel.members.map(m => ({
      id: m.id,
      name: m.displayName || m.nickname || m.email.split("@")[0],
      avatar: m.avatarUrl || "",
    }));

    // Všetci v roome (vrátane admina) dostanú update
    socket.nsp.in(channelName).emit("members:update", {
      channelId: channel.id,
      members: updatedMembersList,
    });

    socket.nsp.in(channelName).emit("member:left", {
      userId,
      nickname: user.displayName || user.nickname || user.email.split("@")[0],
      avatar: user.avatarUrl || "",
      channelName,
    });

    console.log(`USER LEFT via socket: ${user.email} → #${channelName}`);

    // Ak je posledný člen, zmaž kanál a emitni channel:deleted
    if (channel.members.length === 0) {
      const channelId = channel.id;
      await channel.delete();

      // Emitni všetkým (aj tým, čo už odišli)
      socket.nsp.in(channelName).emit('channel:deleted', {
        channelId,
        channelName,
      });

      return { success: true };
    }}

   /**
   * Invite users to a channel
   * - Private: only admin can invite
   * - Public: any member can invite
   */
  public async inviteUsers(
    { params, auth, socket }: WsContextContract,
    nicknames: string[]
  ) {
    const channelName = params.name;
    const currentUser = auth.user!;

    const channel = await Channel.findByOrFail("name", channelName);
    await channel.load("members");

    // Check if user is a member
    const isMember = channel.members.some((m) => m.id === currentUser.id);
    if (!isMember) {
      throw new Error("You must be a member to invite users");
    }

    // Check permissions
    if (channel.type === "private") {
      // Private: only admin can invite
      if (channel.createdBy !== currentUser.id) {
        throw new Error("Only admin can invite users to private channels");
      }
    }
    // Public: any member can invite (no additional check needed)

    const invitedUsers = await User.query().whereIn("nickname", nicknames);

    if (invitedUsers.length === 0) {
      throw new Error("No valid users found");
    }

    const invitations : InvitationPayload[] = [];
    const Ws = (await import('@ioc:Ruby184/Socket.IO/Ws')).default;

    for (const user of invitedUsers) {
      // Check if already a member
      await channel.load("members");
      const isMember = channel.members.some((m) => m.id === user.id);
      if (isMember) continue;

      //check if its pending
      const existing = await ChannelInvitation.query()
        .where("channel_id", channel.id)
        .where("invited_user_id", user.id)
        .where("status", "pending")
        .first();

      if (existing) continue;

      // Create invitation
      const invitation = await ChannelInvitation.create({
        channelId: channel.id,
        invitedUserId: user.id,
        invitedBy: currentUser.id,
        status: "pending",
      });

      await invitation.load("channel");
      await invitation.load("inviter");

      invitations.push({
        id: invitation.id,
        channelId: channel.id,
        channelName: channel.name,
        channelType: channel.type,
        from: currentUser.displayName || currentUser.nickname,
        fromAvatar: currentUser.avatarUrl,
        createdAt: invitation.createdAt,
      });

      // Emit globally to reach user on any socket
      Ws.io.emit("invitation:received", {
        userId: user.id, // Target user
        id: invitation.id,
        channelId: channel.id,
        channelName: channel.name,
        channelType: channel.type,
        from: currentUser.displayName || currentUser.nickname,
        fromAvatar: currentUser.avatarUrl,
        createdAt: invitation.createdAt,
      });
    }

    return {
      success: true,
      invitationsSent: invitations.length,
      invitations,
    };
  }

  /**
   * Revoke/Remove user from channel (admin only for private channels)
   */
  public async revokeUser(
    { params, auth, socket }: WsContextContract,
    nickname: string
  ) {
    const channelName = params.name;
    const currentUser = auth.user!;

    const channel = await Channel.findByOrFail("name", channelName);
    await channel.load("members");

    // Only admin can revoke in private channels
    if (channel.type === "private" && channel.createdBy !== currentUser.id) {
      throw new Error("Only admin can remove users from private channels");
    }

    // Find user to remove
    const userToRemove = await User.query().where("nickname", nickname).first();
    if (!userToRemove) {
      throw new Error("User not found");
    }

    // Check if user is member
    const isMember = channel.members.some((m) => m.id === userToRemove.id);
    if (!isMember) {
      throw new Error("User is not a member of this channel");
    }

    // Cannot remove yourself
    if (userToRemove.id === currentUser.id) {
      throw new Error("Use /cancel to leave the channel");
    }

    // Cannot remove admin
    if (userToRemove.id === channel.createdBy) {
      throw new Error("Cannot remove channel admin");
    }

    // Remove user
    await channel.related("members").detach([userToRemove.id]);
    await channel.load("members");

    // Update members list
    const updatedMembersList = channel.members.map((m) => ({
      id: m.id,
      name: m.displayName || m.nickname || m.email.split("@")[0],
      avatar: m.avatarUrl || "",
    }));

    socket.nsp.to(channelName).emit("members:update", {
      channelId: channel.id,
      members: updatedMembersList,
    });

    // Notify removed user
    const Ws = (await import('@ioc:Ruby184/Socket.IO/Ws')).default;
    channel.members.forEach((member) => {
      Ws.io.emit("members:update:global", {
        userId: member.id,
        channelId: channel.id,
        channelName: channel.name,
        members: updatedMembersList,
      });
    });

    // Notify removed user
    Ws.io.emit("user:removed", {
      userId: userToRemove.id,
      channelId: channel.id,
      channelName: channel.name,
      removedBy: currentUser.displayName || currentUser.nickname,
    });


    return {
      success: true,
      message: `${userToRemove.displayName || userToRemove.nickname} removed from channel`,
    };
  }

  /**
   * User accepts invitation
   */

  public async acceptInvitation(
    {params, auth, socket }: WsContextContract,
    invitationId: number
  ) {
    const user = auth.user!;
    const channelName = params.name;
    const invitation = await ChannelInvitation.query()
      .where("id", invitationId)
      .where("invited_user_id", user.id)
      .where("status", "pending")
      .preload("channel")
      .preload("inviter")
      .firstOrFail();

    invitation.status = "accepted";
    await invitation.save();

    const channel = invitation.channel;
    await channel.load("members");

    //admin unBAN funkcionalita
    const ChannelBan = (await import('App/Models/ChannelBan')).default;
    const inviterIsAdmin = (channel.type === "private" && channel.createdBy === invitation.invitedBy) 
                           || channel.createdBy === invitation.invitedBy; 
    
    // Skontrolujeme, či má pozvaný ban
    const banRecord = await ChannelBan.query()
        .where('channel_id', channel.id)
        .where('user_id', user.id)
        .first();

    if (inviterIsAdmin && banRecord) {
        // Ak je pozývateľ admin a používateľ má ban:
        await banRecord.delete(); // 💥 VYMAZANIE BANU!
        console.log(`UNBAN: User ${user.nickname} unbanned from #${channel.name} via admin invitation.`);
    }

    // Pridaj do členov
    const wasAlreadyMember = channel.members.some(m => m.id === user.id);
    if (!wasAlreadyMember) {
      await channel.related("members").attach([user.id]);
      await channel.load("members");
    }

    // KĽÚČOVÉ: Pripoj socket do roomu (ako keby volal joinChannel)
    socket.join(channelName);
    console.log(`SOCKET JOINED ROOM via acceptInvitation: ${user.email} → #${channel.name}`);

    // Emitni update všetkým v kanáli (vrátane nového člena a admina)
    const updatedMembersList = channel.members.map((m) => ({
      id: m.id,
      name: m.displayName || m.nickname || m.email.split("@")[0],
      avatar: m.avatarUrl || "",
    }));

    // Použi .in() aby to dostal aj nový člen
    socket.nsp.in(channel.name).emit("members:update", {
      channelId: channel.id,
      members: updatedMembersList,
    });

    // Voliteľné: emitni member:joined
    socket.nsp.in(channel.name).emit("member:joined", {
      userId: user.id,
      nickname: user.displayName || user.nickname || user.email.split("@")[0],
      avatar: user.avatarUrl || "",
      channelName: channel.name,
    });

    console.log(`USER JOINED (via invitation): ${user.email} → #${channel.name}`);

    return {
      success: true,
      channel: {
        id: channel.id,
        name: channel.name,
        type: channel.type,
        isAdmin: channel.createdBy === user.id,
      },
    };
  }
  
  
  //   public async acceptInvitation(
  //   { auth, socket }: WsContextContract,
  //   invitationId: number
  // ) {
  //   const user = auth.user!;

  //   const invitation = await ChannelInvitation.query()
  //     .where("id", invitationId)
  //     .where("invited_user_id", user.id)
  //     .where("status", "pending")
  //     .preload("channel")
  //     .firstOrFail();

  //   // Update invitation status
  //   invitation.status = "accepted";
  //   await invitation.save();

  //   const channel = invitation.channel;

  //   // Add user to channel
  //   await channel.related("members").attach([user.id]);
  //   await channel.load("members");

  //   // Join socket room
  //   socket.join(channel.name);

  //   // Emit updated members list to everyone in channel
  //   const updatedMembersList = channel.members.map((m) => ({
  //     id: m.id,
  //     name: m.displayName || m.nickname || m.email.split("@")[0],
  //     avatar: m.avatarUrl || "",
  //   }));

  //   // ✅ EMIT do room (pre pripojených cez WS)
  //   socket.nsp.to(channel.name).emit("members:update", {
  //     channelId: channel.id,
  //     members: updatedMembersList,
  //   });

  //   // ✅ EMIT GLOBÁLNE pre všetkých členov kanála
  //   const Ws = (await import('@ioc:Ruby184/Socket.IO/Ws')).default;
  //   channel.members.forEach((member) => {
  //     Ws.io.emit("members:update:global", {
  //       userId: member.id,
  //       channelId: channel.id,
  //       channelName: channel.name,
  //       members: updatedMembersList,
  //     });
  //   });

  //   // Notify everyone that user joined
  //   socket.nsp.to(channel.name).emit("member:joined", {
  //     userId: user.id,
  //     nickname: user.displayName || user.nickname,
  //     avatar: user.avatarUrl,
  //     channelName: channel.name,
  //   });

  //   return {
  //     success: true,
  //     channel: {
  //       id: channel.id,
  //       name: channel.name,
  //       type: channel.type,
  //       isAdmin: channel.createdBy === user.id,
  //     },
  //   };
  // }

  /**
   * User declines invitation
   */
  public async declineInvitation(
    { auth }: WsContextContract,
    invitationId: number
  ) {
    const user = auth.user!;

    const invitation = await ChannelInvitation.query()
      .where("id", invitationId)
      .where("invited_user_id", user.id)
      .where("status", "pending")
      .firstOrFail();

    invitation.status = "declined";
    await invitation.save();

    return { success: true };
  }

  /**
   * Get pending invitations for current user
   */
  public async getInvitations({ auth }: WsContextContract) {
    const user = auth.user!;

    const invitations = await ChannelInvitation.query()
      .where("invited_user_id", user.id)
      .where("status", "pending")
      .preload("channel")
      .preload("inviter");

    return invitations.map((inv) => ({
      id: inv.id,
      channelId: inv.channel.id,
      channelName: inv.channel.name,
      from: inv.inviter.displayName || inv.inviter.nickname,
      fromAvatar: inv.inviter.avatarUrl,
      createdAt: inv.createdAt,
    }));
  }
}