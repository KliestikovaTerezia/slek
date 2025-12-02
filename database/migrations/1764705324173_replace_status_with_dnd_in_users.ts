import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class ReplaceStatusWithDndInUsers extends BaseSchema {
  protected tableName = 'users'

  public async up() {
    this.schema.alterTable(this.tableName, (table) => {
      // 1. Drop the existing 'status' column
      table.dropColumn('status')

      // 2. Add the new 'dnd' column as a boolean, defaulting to false
      // In many SQL dialects, this maps to a boolean or tinyint(1).
      table.boolean('dnd').notNullable().defaultTo(false)
    })
  }

  public async down() {
  }
}