import { Kysely, SqliteDialect, PostgresDialect, MysqlDialect } from 'kysely';
import Database from 'better-sqlite3';
import mysql from 'mysql2/promise';

const sanitizeName = value => value.replace(/[^a-z0-9]/gi, '_');
const shortMessage = error => {
  if (!error) return 'unknown error';
  const message = typeof error === 'string' ? error : error.message || String(error);
  return message.split('\n')[0].trim();
};

let tableCounter = 0;
const buildTempTableName = type =>
  `test_table_${sanitizeName(type)}_${Date.now().toString(36)}_${(tableCounter++).toString(36)}`;

const vendorDefinitions = [
  {
    name: 'sqlite',
    types: ['integer', 'text', 'real', 'blob', 'boolean', 'date', 'datetime'],
    init: async () => {
      const database = new Database(':memory:');
      const db = new Kysely({ dialect: new SqliteDialect({ database }) });
      return {
        db,
        async dispose() {
          await db.destroy();
        },
      };
    },
  },
  {
    name: 'postgres',
    types: ['integer', 'bigint', 'text', 'boolean', 'date', 'timestamp', 'json', 'uuid'],
    init: async () => {
      let pgModule;
      try {
        pgModule = await import('pg');
      } catch (error) {
        if (error.code === 'ERR_MODULE_NOT_FOUND') {
          throw new Error('package "pg" is not installed');
        }
        throw error;
      }
      const { Pool } = pgModule;
      const connectionString =
        process.env.POSTGRES_URL ||
        process.env.KYSELY_POSTGRES_URL ||
        'postgres://postgres:pg123@localhost:5435/mydb';
      const pool = new Pool({ connectionString, max: 1 });
      try {
        const client = await pool.connect();
        client.release();
      } catch (error) {
        await pool.end().catch(() => {});
        throw new Error(`connection failed (${shortMessage(error)})`);
      }
      const db = new Kysely({ dialect: new PostgresDialect({ pool }) });
      return {
        db,
        async dispose() {
          await db.destroy();
        },
      };
    },
  },
  {
    name: 'mysql',
    types: ['int', 'bigint', 'varchar(255)', 'text', 'boolean', 'date', 'datetime', 'json'],
    init: async () => {
      const uri = process.env.MYSQL_URL || process.env.KYSELY_MYSQL_URL;
      const inferredPort = Number(
        process.env.MYSQL_PORT || process.env.MYSQL8016_PORT || 3309,
      );

      const baseConfig = {
        host: process.env.MYSQL_HOST || '127.0.0.1',
        port: Number.isNaN(inferredPort) ? 3309 : inferredPort,
        database: process.env.MYSQL_DATABASE || 'mydb',
        waitForConnections: true,
      };

      const candidates = uri
        ? [uri]
        : [
            {
              ...baseConfig,
              user: process.env.MYSQL_USER || 'appuser',
              password: process.env.MYSQL_PASSWORD || 'app123',
            },
            {
              ...baseConfig,
              user: process.env.MYSQL_ROOT_USER || 'root',
              password:
                process.env.MYSQL_ROOT_PASSWORD || process.env.MYSQL_PASSWORD || 'root123',
            },
          ];

      let pool;
      let connectionError;

      for (const candidate of candidates) {
        pool = mysql.createPool(candidate);
        try {
          const connection = await pool.getConnection();
          connection.release();
          connectionError = undefined;
          break;
        } catch (error) {
          connectionError = error;
          await pool.end().catch(() => {});
          pool = undefined;
        }
      }

      if (!pool) {
        throw new Error(`connection failed (${shortMessage(connectionError)})`);
      }
      const db = new Kysely({ dialect: new MysqlDialect({ pool }) });
      return {
        db,
        async dispose() {
          await db.destroy();
        },
      };
    },
  },
];

async function testAddColumn(db, vendorName, type) {
  const tableName = buildTempTableName(type);
  try {
    await db.schema
      .createTable(tableName)
      .addColumn('id', 'integer', col => col.primaryKey())
      .execute();
    await db.schema.alterTable(tableName).addColumn('test_col', type).execute();
    console.log(`[${vendorName}] ${type}: ✅`);
  } catch (error) {
    console.log(`[${vendorName}] ${type}: ❌ (${shortMessage(error)})`);
  } finally {
    await db.schema.dropTable(tableName).ifExists().execute().catch(() => {});
  }
}

async function run() {
  for (const vendor of vendorDefinitions) {
    let context;
    try {
      context = await vendor.init();
    } catch (error) {
      console.log(`[${vendor.name}] skipped: ${shortMessage(error)}`);
      continue;
    }

    try {
      console.log(`[${vendor.name}] testing ${vendor.types.length} data types...`);
      for (const type of vendor.types) {
        await testAddColumn(context.db, vendor.name, type);
      }
    } finally {
      await context.dispose().catch(err => {
        console.log(`[${vendor.name}] cleanup failed: ${shortMessage(err)}`);
      });
    }
  }
}

run().catch(error => {
  console.error('Unexpected failure:', error);
  process.exit(1);
});
