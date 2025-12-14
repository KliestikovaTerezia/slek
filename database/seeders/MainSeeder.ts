import BaseSeeder from '@ioc:Adonis/Lucid/Seeder';
import UserSeeder from './UserSeeder'
import ChannelSeeder from './ChannelSeeder'

export default class MainSeeder extends BaseSeeder {
  public async run() {
    // spusti UserSeeder
    const userSeeder = new UserSeeder(this.client)
    await userSeeder.run()

    // spusti ChannelSeeder
    const channelSeeder = new ChannelSeeder(this.client)
    await channelSeeder.run()
  }
}