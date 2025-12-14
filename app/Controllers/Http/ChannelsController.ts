import Channel from 'App/Models/Channel'
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
import Ws from '@ioc:Ruby184/Socket.IO/Ws'
import User from 'App/Models/User'
import ChannelKick from 'App/Models/ChannelKick'
import ChannelBan from 'App/Models/ChannelBan'

export default class ChannelsController {
  public async index({ response, auth }: HttpContextContract) {
    const currentUserId = auth.user?.id
    if (!currentUserId) {
      return response.unauthorized({ error: 'Not authenticated' })
    }

    const channels = await Channel.query()
      .whereHas('members', (query) => {
        query.where('user_id', currentUserId)
      })
      .preload('members')

    return response.json(
      channels.map((ch) => {
        const members = ch.members.map((m) => ({
          id: m.id,
          name: m.displayName,
          avatar: m.avatarUrl,
        }))

        // check ci je aktualny user admin kanalu
        const isCurrentUserAdmin = ch.createdBy === currentUserId

        return {
          id: ch.id,
          name: ch.name,
          type: ch.type,
          createdBy: ch.createdBy,
          members,
          isAdmin: isCurrentUserAdmin,
        }
      })
    )
  }

  public async create({ request, response, auth }: HttpContextContract) {
    const { name, type, memberIds } = request.only(['name', 'type', 'memberIds'])
    const currentUserId = auth.user?.id
    if (!currentUserId) {
      return response.unauthorized({ error: 'Not authenticated' })
    }

    // create channel
    const channel = await Channel.create({
      name,
      type: type || 'public',
      createdBy: currentUserId,
    })

    // pridaj admina ako member
    await channel.related('members').attach([currentUserId])

    // pridaj ostatnych memberov
    if (memberIds && memberIds.length > 0) {
      await channel.related('members').attach(memberIds)
    }

    // nahraj memberov
    await channel.load('members')

    const members = channel.members.map((m) => ({
      id: m.id,
      name: m.displayName,
      avatar: m.avatarUrl,
    }))

    return response.created({
      id: channel.id,
      name: channel.name,
      type: channel.type,
      createdBy: channel.createdBy,
      members,
      isAdmin: true, // creator je admin
    })
  }

  //vrati vseetky channels z databazy, nie iba ktorych je clenom
  public async all({ response }: HttpContextContract) {
    const channels = await Channel.query()
      .preload('members') 

    return response.json(
      channels.map((ch) => ({
        id: ch.id,
        name: ch.name,
        type: ch.type as 'public' | 'private',
        memberCount: ch.members.length,
      }))
    )
  }

  public async destroy({ params, response, auth }: HttpContextContract) {
    const currentUserId = auth.user?.id
    if (!currentUserId) {
      return response.unauthorized({ error: 'Not authenticated' })
    }

    const channel = await Channel.find(params.id)
    
    if (!channel) {
      return response.notFound({ error: 'Channel not found' })
    }

    // iba admin moze mazat kanal
    if (channel.createdBy !== currentUserId) {
      return response.forbidden({ error: 'Only the channel creator can delete it' })
    }

    await channel.delete()
    
    return response.ok({ message: 'Channel deleted successfully' })
  }

  public async leave({ params, response, auth }: HttpContextContract) {
    const userId = auth.user!.id
    const channel = await Channel.find(params.id)
    if (!channel) return response.notFound()

    await channel.load('members')

    await channel.related('members').detach([userId])
    await channel.load('members')

    const leavingUser = await User.find(userId)

    // emit member:left
    Ws.io.to(channel.name).emit('member:left', {
      userId,
      nickname: leavingUser?.displayName || leavingUser?.email.split('@')[0],
      avatar: leavingUser?.avatarUrl || '',
      channelName: channel.name,
    })

    // emit members:update
    const updatedMembersList = channel.members.map((m) => ({
      id: m.id,
      name: m.displayName || m.nickname || m.email.split('@')[0],
      avatar: m.avatarUrl || '',
    }))

    Ws.io.to(channel.name).emit('members:update', {
      channelId: channel.id,
      members: updatedMembersList,
    })

    // ak si poslednym clenom, zmaz kanal
    if (channel.members.length === 0) {
      const channelName = channel.name
      await channel.delete()

      Ws.io.to(channelName).emit('channel:deleted', {
        channelId: channel.id,
        channelName,
      })

      return response.ok({ deleted: true, message: 'Last member left -> channel deleted' })
    }

    return response.ok({ deleted: false })
  }

  public async kick({ params, request, response, auth }: HttpContextContract) {
  const currentUserId = auth.user?.id
  if (!currentUserId) {
    return response.unauthorized({ error: 'Not authenticated' })
  }

  const channelId = params.id
  const { nickname } = request.only(['nickname'])

  if (!nickname) {
    return response.badRequest({ error: 'Nickname is required' })
  }

  // nacitaj channel
  const channel = await Channel.find(channelId)
  if (!channel) {
    return response.notFound({ error: 'Channel not found' })
  }

  // je channel public?
  if (channel.type !== 'public') {
    return response.forbidden({ error: 'Kick voting only works in public channels' })
  }

  // najdi usera na kick
  const userToKick = await User.query().where('nickname', nickname).first()
  if (!userToKick) {
    return response.notFound({ error: 'User not found' })
  }

  // nemozes seba kicknut
  if (userToKick.id === currentUserId) {
    return response.badRequest({ error: 'You cannot kick yourself' })
  }

  // check ci je user member kanalu
  await channel.load('members')
  const isMember = channel.members.some(m => m.id === userToKick.id)
  if (!isMember) {
    return response.badRequest({ error: 'User is not a member of this channel' })
  }

  // check ci som admin
  const isAdmin = channel.createdBy === currentUserId

  if (isAdmin) {
    // Admin kick = instant ban
    // check ci je user uz banned
    const existingBan = await ChannelBan.query()
      .where('channel_id', channelId)
      .where('user_id', userToKick.id)
      .first()

    if (existingBan) {
      return response.badRequest({ error: 'User is already banned' })
    }

    // create ban
    await ChannelBan.create({
      channelId,
      userId: userToKick.id,
      bannedBy: currentUserId,
    })

    //odstran usera z channel members
    await channel.related('members').detach([userToKick.id])

    // emit WebSocket event
    const Ws = (await import('@ioc:Ruby184/Socket.IO/Ws')).default
      Ws.io.to(`channels:${channel.name}`).emit('user:kicked', {
        userId: userToKick.id,
        nickname: userToKick.nickname,
        displayName: userToKick.displayName,
        bannedBy: isAdmin ? auth.user?.nickname : 'vote',
        isAdmin: isAdmin,
      })

    return response.ok({ 
      message: `${userToKick.displayName} has been banned from the channel`,
      banned: true
    })
  }

  // Non-admin kick = vote
  // ckeck ci uz za neho user hlasoval
  const existingVote = await ChannelKick.query()
    .where('channel_id', channelId)
    .where('kicked_user_id', userToKick.id)
    .where('kicker_user_id', currentUserId)
    .first()

  if (existingVote) {
    return response.badRequest({ error: 'You already voted to kick this user' })
  }

  // pridaj hlas
  await ChannelKick.create({
    channelId,
    kickedUserId: userToKick.id,
    kickerUserId: currentUserId,
  })

  // spocitaj hlasy
  const voteCount = await ChannelKick.query()
    .where('channel_id', channelId)
    .where('kicked_user_id', userToKick.id)
    .count('* as total')

  const votes = voteCount[0].$extras.total

  // If 3+ votes, ban the user
  if (votes >= 3) {
    await ChannelBan.create({
      channelId,
      userId: userToKick.id,
      bannedBy: null, // Vote-based ban
    })

    // odstran usera z channel members
    await channel.related('members').detach([userToKick.id])

    // emit WebSocket event so its dynamic
    const Ws = (await import('@ioc:Ruby184/Socket.IO/Ws')).default
    Ws.io.to(`channels:${channel.name}`).emit('user:kicked', {
      userId: userToKick.id,
      nickname: userToKick.nickname,
      displayName: userToKick.displayName,
      bannedBy: isAdmin ? auth.user?.nickname : 'vote',
      isAdmin: isAdmin,
    })

    return response.ok({ 
      message: `${userToKick.displayName} has been banned (${votes} votes)`,
      banned: true,
      votes
    })
  }

  return response.ok({ 
    message: `Vote recorded (${votes}/3 votes to ban)`,
    banned: false,
    votes
  })
}
}