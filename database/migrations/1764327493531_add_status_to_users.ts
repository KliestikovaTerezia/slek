import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class AddStatusToUsers extends BaseSchema {
  protected tableName = 'users'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.enum('status', ['online','dnd','offline']).defaultTo('online')
    })
  }

  public async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('status')
    })
  }
}
