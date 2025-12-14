import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'channels'

  public async up() {
      this.schema.alterTable(this.tableName, (table) => {
        table
          .integer('created_by')
          .unsigned()
          .references('id')
          .inTable('users')
          .onDelete('CASCADE')
          .after('type') 
      })
    }

    public async down() {
      this.schema.alterTable(this.tableName, (table) => {
        table.dropColumn('created_by')
      })
    }
  }