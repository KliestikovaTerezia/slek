import Notification from 'App/Models/Notification'
import { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

export default class NotificationsController {
  public async index({ auth }: HttpContextContract) {
    const user = auth.user!

    const notifications = await Notification
      .query()
      .where('user_id', user.id)
      .orderBy('created_at', 'desc')

    return notifications
  }

    public async destroy({ params, auth, response }: HttpContextContract) {
    const user = auth.user!

    const notification = await Notification
      .query()
      .where('id', params.id)
      .where('user_id', user.id)
      .first()

    if (!notification) {
      return response.notFound({ message: 'Notification not found' })
    }

    await notification.delete()
    return { success: true }
  }
}
