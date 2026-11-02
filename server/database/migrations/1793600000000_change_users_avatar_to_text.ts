import BaseSchema from '@ioc:Adonis/Lucid/Schema'

export default class extends BaseSchema {
  protected tableName = 'users'

  // avatar is stored as a base64 data URL, which does not fit into varchar(255) on Postgres.
  // SQLite does not enforce the length, so it is left as is there.
  public async up () {
    if (this.db.dialect.name !== 'postgres') return

    this.schema.alterTable(this.tableName, (table) => {
      table.text('avatar').nullable().alter()
    })
  }

  public async down () {
    if (this.db.dialect.name !== 'postgres') return

    this.schema.alterTable(this.tableName, (table) => {
      table.string('avatar').nullable().alter()
    })
  }
}
