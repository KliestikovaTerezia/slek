import cron from 'node-cron'
import Channel from 'App/Models/Channel'
import Notification from 'App/Models/Notification'
import { DateTime } from 'luxon'
import Ws from '@ioc:Ruby184/Socket.IO/Ws'

export async function processInactiveChannels() {
  console.log('[CRON] Checking inactive channels...')
  const threshold = DateTime.now().minus({ days: 30 })

  const channels = await Channel.query()
    .preload('members')
    .where('updated_at', '<', threshold.toSQL())

  if (channels.length === 0) {
    console.log('[CRON] No inactive channels found.')
    return
  }

  console.log(`[CRON] Found ${channels.length} inactive channels.`)

  for (const channel of channels) {
    console.log(`[CRON] Deleting channel: ${channel.name}`)

    for (const user of channel.members) {
      const message = `Channel "${channel.name}" was deleted due to 30 days of inactivity.`
      const notification = await Notification.create({
        userId: user.id,
        message,
      })
      Ws.io.to(`user:${user.id}`).emit('notification:new', notification)
    }

    await channel.delete()
    console.log(`[CRON] Channel deleted: ${channel.name}`)
  }

  console.log('[CRON] Finished processing inactive channels.')
}

cron.schedule('0 0 * * *', processInactiveChannels)
