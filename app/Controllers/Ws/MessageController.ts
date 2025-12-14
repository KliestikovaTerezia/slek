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

    // najdi alebo vytvor kanal
    let channel = await Channel.firstOrCreate(
      { name: channelName },
      {
        name: channelName,
        type: "public",
        createdBy: userId,
      }
    );

    // nacitaj clenov
    await channel.load("members");

    // zisti ci uz bol clenom
    const wasAlreadyMember = channel.members.some((m) => m.id === userId);

    // ak nie je clenom - pridaj ho
    if (!wasAlreadyMember) {
      await channel.related("members").attach([userId]);
      await channel.load("members"); // znova načítaj po attach
    }

    // pripoj socket do roomu
    socket.join(channelName);

    // emit members:update pre vsetkych (aj noveho clena)
    const updatedMembersList = channel.members.map((m) => ({
      id: m.id,
      name: m.displayName || m.nickname || m.email.split("@")[0],
      avatar: m.avatarUrl || "",
    }));

    // posli vsetkym v kanali (vratane toho, kto sa prave pridal)
    socket.nsp.to(channelName).emit("members:update", {
      channelId: channel.id,
      members: updatedMembersList,
    });

    console.log(`USER JOINED: ${user.email} → #${channelName} (admin: ${channel.createdBy === userId})`);

    return {
      success: true,
      channel: channelName,
      channelId: channel.id,
      isAdmin: channel.createdBy === userId,
    };
  }

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

    // over ci je clenom
    const channel = await Channel.query()
      .where("name", channelName)
      .whereHas("members", (q) => q.where("users.id", userId))
      .firstOrFail();

    socket.join(channelName);

    // vytvor spravu
    const message = await this.messageRepository.create(channelName, userId, content);

    // posli vsetkym v roomke
    socket.nsp.to(channelName).emit("message", message);

    return message;
  }

  public async deleteChannel({ auth, socket }: WsContextContract, channelId: number) {
    const user = auth.user!
    const channel = await Channel.findOrFail(channelId)

    if (channel.createdBy !== user.id) {
      throw new Error('Only channel creator can delete it')
    }

    const channelName = channel.name

    await channel.delete()

    // Posli vsetkym v roomke (aj adminovi)
    socket.nsp.emit('channel:deleted', {
      channelId: channel.id,
      channelName,
      deletedBy: user.displayName || user.nickname,
    })
    console.log('Ano delete prebehol.')
    const Ws = (await import('@ioc:Ruby184/Socket.IO/Ws')).default
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
  
  userDndStatuses[user.id] = payload.dnd;
  console.log('[Server] updateDnd called for user:', user.email, 'payload:', payload);

  const Ws = (await import('@ioc:Ruby184/Socket.IO/Ws')).default;

  // Broadcast DND pre vsetkych
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
  payload: { status: "online" | "offline"; userId?: number }
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

  // nacitaj vsetkych userov s tymi ID z db
  const users = await User.query().whereIn('id', userIds);

  const statuses = users.map(u => ({
    userId: u.id,
    status: userStatuses[u.id],
    nickname: u.displayName || u.nickname || u.email.split('@')[0],
    avatar: u.avatarUrl,
  }));

  return statuses;
}

//typing
public async userTyping(
  { auth, socket }: WsContextContract,
  payload: { typing: boolean; text?: string }  
) {
  const user = auth.user!;
  const channelName = socket.nsp.name.split('/').pop();

  console.log(
    `[Server] User ${user.email} is ${payload.typing ? 'typing' : 'stopped typing'} in #${channelName}`,
    ',text:', payload.text
  );

  // Broadcast vsetkym v channeli okrem seba
  socket.broadcast.to(channelName!).emit('user:typing', {
    userId: user.id,
    nickname: user.displayName || user.nickname || user.email.split('@')[0],
    avatar: user.avatarUrl || "",
    typing: payload.typing,
    text: payload.text, 
  });
  //nepotrebujeme return
}

//ma user ban?
public async checkBanStatus({ auth }: WsContextContract, channelName: string) {
    const userId = auth.user!.id;

    const channel = await Channel.query().where('name', channelName).first();

    if (!channel) {
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

    // vsetko ok, mozes sa pridat
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

    // vsetci v roomke dostanu update
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

    // ak je posledny clem, zmaz kanal a emitni channel:deleted
    if (channel.members.length === 0) {
      const channelId = channel.id;
      await channel.delete();

      // emitnu vsetkym
      socket.nsp.in(channelName).emit('channel:deleted', {
        channelId,
        channelName,
      });

      return { success: true };
    }}


  public async inviteUsers(
    { params, auth, socket }: WsContextContract,
    nicknames: string[]
  ) {
    const channelName = params.name;
    const currentUser = auth.user!;

    const channel = await Channel.findByOrFail("name", channelName);
    await channel.load("members");

    // check ci uz je clenom
    const isMember = channel.members.some((m) => m.id === currentUser.id);
    if (!isMember) {
      throw new Error("You must be a member to invite users");
    }

    // check pravidla pozvani
    if (channel.type === "private") {
      // Private: only admin can invite
      if (channel.createdBy !== currentUser.id) {
        throw new Error("Only admin can invite users to private channels");
      }
    }

    // Public: hocikto moze
    const invitedUsers = await User.query().whereIn("nickname", nicknames);

    if (invitedUsers.length === 0) {
      throw new Error("No valid users found");
    }

    const invitations : InvitationPayload[] = [];
    const Ws = (await import('@ioc:Ruby184/Socket.IO/Ws')).default;

    for (const user of invitedUsers) {
      // check ci uz je clenom
      await channel.load("members");
      const isMember = channel.members.some((m) => m.id === user.id);
      if (isMember) continue;

      //check ci ma uz pozvanku pending
      const existing = await ChannelInvitation.query()
        .where("channel_id", channel.id)
        .where("invited_user_id", user.id)
        .where("status", "pending")
        .first();

      if (existing) continue;

      // create invitation
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

      // emit globalne
      Ws.io.emit("invitation:received", {
        userId: user.id, //komu posielame, target
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

//revoke user - iba admin pre private channels
  public async revokeUser(
    { params, auth, socket }: WsContextContract,
    nickname: string
  ) {
    const channelName = params.name;
    const currentUser = auth.user!;

    const channel = await Channel.findByOrFail("name", channelName);
    await channel.load("members");

    // iba admin moze odoberat userov v private channels
    if (channel.type === "private" && channel.createdBy !== currentUser.id) {
      throw new Error("Only admin can remove users from private channels");
    }

    // najdi usera na odstranenie
    const userToRemove = await User.query().where("nickname", nickname).first();
    if (!userToRemove) {
      throw new Error("User not found");
    }

    //ckeck ci je clenom kanala
    const isMember = channel.members.some((m) => m.id === userToRemove.id);
    if (!isMember) {
      throw new Error("User is not a member of this channel");
    }

    // nemozes odstranit sam seba
    if (userToRemove.id === currentUser.id) {
      throw new Error("Use /cancel to leave the channel");
    }

    // nemozes odstranit admina kanala
    if (userToRemove.id === channel.createdBy) {
      throw new Error("Cannot remove channel admin");
    }

    // odstran usera
    await channel.related("members").detach([userToRemove.id]);
    await channel.load("members");

    // update list
    const updatedMembersList = channel.members.map((m) => ({
      id: m.id,
      name: m.displayName || m.nickname || m.email.split("@")[0],
      avatar: m.avatarUrl || "",
    }));

    socket.nsp.to(channelName).emit("members:update", {
      channelId: channel.id,
      members: updatedMembersList,
    });

    // notifikuj vsetkych globalne
    const Ws = (await import('@ioc:Ruby184/Socket.IO/Ws')).default;
    channel.members.forEach((member) => {
      Ws.io.emit("members:update:global", {
        userId: member.id,
        channelId: channel.id,
        channelName: channel.name,
        members: updatedMembersList,
      });
    });

    // notifikuj odstraneneho usera
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
    
    // Skontrolujeme, ci ma pozvany ban
    const banRecord = await ChannelBan.query()
        .where('channel_id', channel.id)
        .where('user_id', user.id)
        .first();

    if (inviterIsAdmin && banRecord) {
        // ak je user admin a pozvany ma ban
        await banRecord.delete(); // UZ NEMA BAN
        console.log(`UNBAN: User ${user.nickname} unbanned from #${channel.name} via admin invitation.`);
    }

    // pridaj usera do clenov
    const wasAlreadyMember = channel.members.some(m => m.id === user.id);
    if (!wasAlreadyMember) {
      await channel.related("members").attach([user.id]);
      await channel.load("members");
    }

    socket.join(channelName);
    console.log(`SOCKET JOINED ROOM via acceptInvitation: ${user.email} → #${channel.name}`);

    // emit updtae vsetkym v kanali
    const updatedMembersList = channel.members.map((m) => ({
      id: m.id,
      name: m.displayName || m.nickname || m.email.split("@")[0],
      avatar: m.avatarUrl || "",
    }));

    socket.nsp.in(channel.name).emit("members:update", {
      channelId: channel.id,
      members: updatedMembersList,
    });

    // emitni member:joined
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