// app/Controllers/Http/UsersController.ts
import User from 'App/Models/User'
import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'

export default class UsersController {
  public async index({ response, auth }: HttpContextContract) {
    const currentUserId = auth.user?.id
    if (!currentUserId) {
      return response.unauthorized({ error: 'Not authenticated' })
    }

    const users = await User.all()
    
    return response.json(
      users.map((u) => ({
        id: u.id,
        name: u.displayName,
        nickname: u.nickname,
        avatar: u.avatarUrl,
        email: u.email,
        status: 'online', // TODO: Add real status tracking
      }))
    )
  }

  public async getDnd({ auth }: HttpContextContract) {
    const user = auth.user!
    return { dnd: user.dnd || false } // predpokladám, že máš stĺpec dnd v DB
  }
}