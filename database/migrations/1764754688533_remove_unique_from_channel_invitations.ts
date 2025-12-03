import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class RemoveUniqueFromChannelInvitations extends BaseSchema {
  protected tableName = 'channel_invitations'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropUnique(['channel_id', 'invited_user_id'])
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.unique(['channel_id', 'invited_user_id'])
    })
  }
}
