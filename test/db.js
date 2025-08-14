// db.mjs
import { Kysely, SqliteDialect } from 'kysely'
import Database from 'better-sqlite3'

export function createTestDB () {
  return new Kysely({
    dialect: new SqliteDialect({
      database: new Database(':memory:')
    })
  })
}