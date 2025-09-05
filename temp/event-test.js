// Event test for SQLTable create/drop lifecycle in temp/
import { SQLTable } from '../src/sql-table.js'
import { SqliteDialect } from 'kysely'
import Database from 'better-sqlite3'
import { viewTable } from './view-table.js'

async function main() {
  // Setup in-memory SQLite connection
  const table = new SQLTable('evt_person')
  table.connect = {
    dialect: new SqliteDialect({ database: new Database(':memory:') })
  }
  table.profile = { vendor: 'sqlite' }

  // Define columns (using properties consumed by create())
  table.columns.add('id')
  table.columns.add('name')
  table.columns.add('age')
  table.columns.id.dataType = 'integer'
  table.columns.id.pk = true
  table.columns.id.autoIncrement = true
  table.columns.name.dataType = 'text'
  table.columns.age.dataType = 'integer'

  const fired = []
  const log = (msg) => {
    fired.push(msg)
    console.log('[event]', msg)
  }

  // Register event handlers (sync-only; async work is done outside)
  table.onCreating(({ table: t, db }) => {
    log(`creating: ${t.tableName}`)
    if (!db) throw new Error('creating: db is undefined')
  })

  table.onCreated(({ table: t }) => {
    log(`created: ${t.tableName}`)
  })

  table.onDropping(({ table: t }) => {
    log(`dropping: ${t.tableName}`)
  })

  table.onDropped(({ table: t }) => {
    log(`dropped: ${t.tableName}`)
  })

  try {
    console.log('--- create() ---')
    await table.create()
    await viewTable(table.db, 'After create')

    console.log('--- drop() ---')
    await viewTable(table.db, 'Before drop')
    await table.drop()
    await viewTable(table.db, 'After drop')

    // Simple order assertion
    const expectOrder = [
      'creating: evt_person',
      'created: evt_person',
      'dropping: evt_person',
      'dropped: evt_person'
    ]
    const ok = JSON.stringify(fired) === JSON.stringify(expectOrder)
    console.log('Event order OK:', ok)
    if (!ok) {
      console.log('Expected:', expectOrder)
      console.log('Actual  :', fired)
    }
  } catch (error) {
    console.error('Error during create/drop:', error)
  } finally {
    await table.db.destroy()
  }
}

// Run
main().catch((err) => {
  console.error(err)
  process.exitCode = 1
})
