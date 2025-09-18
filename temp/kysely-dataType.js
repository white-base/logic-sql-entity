import { Kysely, SqliteDialect, PostgresDialect, MysqlDialect } from 'kysely';
import Database from 'better-sqlite3';
import mysql from 'mysql2';


// MYSQL 접속 정보 환경변수에서 참조
const MYSQL_CONFIG = {
  host: process.env.MYSQL8016_HOST ?? '127.0.0.1',
  port: Number(process.env.MYSQL8016_PORT ?? '3309'),
  user: process.env.MYSQL8016_USER ?? 'root',
  password: process.env.MYSQL8016_PASSWORD ?? 'root123',
  database: process.env.MYSQL8016_DB ?? 'mydb',
  waitForConnections: true,
  connectionLimit: 5,
//   allowPublicKeyRetrieval: true,
};

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
    // {
    //     name: 'sqlite',
    //     typeBase : ['integer', 'bigint', 'varchar(n)', 'text', 'smallint', 'real', 'float', 'numeric(10,2)', 'decimal(10,2)', 'char(10)', 'time', 'timestamp'],
    //     typeExtend: ['boolean', 'datetime', 'json', 'uuid', 'binary(16)', 'varbinary(255)', 'blob', 'bytea', 'timestamptz', 'date'],
    //     types: [
    //         'integer', 'text', 'real', 'blob', 'boolean', 'date', 'datetime', 'json',
    //         'smallint', 'double', 'float', 'numeric(10,2)', 'decimal(10,2)', 'char(10)',
    //         'time', 'timestamp', 'timestamptz', 'varbinary(255)', 'binary(16)', 'bytea', 'char(36)', 'uuid'
    //     ],
    //     init: async () => {
    //         const database = new Database(':memory:');
    //         const db = new Kysely({ dialect: new SqliteDialect({ database }) });
    //         return {
    //             db,
    //             async dispose() {
    //                 await db.destroy();
    //             },
    //         };
    //     },
    // },
    {
        name: 'mysql',
        types: [
            'int', 'integer', 'bigint', 'varchar(255)', 'text', 'boolean', 'date', 'datetime', 'json',
            'smallint', 'double', 'real', 'float', 'numeric(10,2)', 'decimal(10,2)', 'char(10)',
            'time', 'timestamp', 'uuid', 'varbinary(255)', 'binary(16)', 'blob', 'char(36)', 'uuid'
        ],
        init: async () => {
            const pool = mysql.createPool(MYSQL_CONFIG);
            const db = new Kysely({ dialect: new MysqlDialect({ pool }) });
            return {
                db,
                async dispose() {
                    await db.destroy();
                    // await pool.end().catch(() => {});
                },
            };
        },
    },
    // {
    //     name: 'postgres',
    //     types: [
    //         'integer', 'bigint', 'text', 'boolean', 'date', 'timestamp', 'json', 'uuid',
    //         'smallint', 'double precision', 'real', 'numeric(10,2)', 'decimal(10,2)', 'char(10)',
    //         'time', 'timestamptz', 'varbinary(255)', 'binary(16)', 'bytea', 'char(36)', 'uuid'
    //     ],
    //     init: async () => {
    //         let pgModule;
    //         try {
    //             pgModule = await import('pg');
    //         } catch (error) {
    //             if (error.code === 'ERR_MODULE_NOT_FOUND') {
    //                 throw new Error('package "pg" is not installed');
    //             }
    //             throw error;
    //         }
    //         const { Pool } = pgModule;
    //         const connectionString =
    //             process.env.POSTGRES_URL ||
    //             process.env.KYSELY_POSTGRES_URL ||
    //             'postgres://postgres:pg123@localhost:5435/mydb';
    //         const pool = new Pool({ connectionString, max: 1 });
    //         try {
    //             const client = await pool.connect();
    //             client.release();
    //         } catch (error) {
    //             await pool.end().catch(() => {});
    //             throw new Error(`connection failed (${shortMessage(error)})`);
    //         }
    //         const db = new Kysely({ dialect: new PostgresDialect({ pool }) });
    //         return {
    //             db,
    //             async dispose() {
    //                 await db.destroy();
    //             },
    //         };
    //     },
    // },
];

// 전체 자료형 나열 (중복 제거)
const allTypes = Array.from(
    new Set(
        vendorDefinitions.flatMap(v => v.types)
    )
);
console.log('전체 자료형:', allTypes);

function parseTypeSpec(type) {
  const match = /^\s*([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*$/.exec(type);
  if (!match) return { base: type, args: [] };
  const args = match[2]
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return { base: match[1], args };
}

async function addColumnWithVendor(db, tableName, columnName, type, vendorName) {
  if (vendorName !== 'mysql') {
    await db.schema.alterTable(tableName).addColumn(columnName, type).execute();
    return;
  }

  const { base, args } = parseTypeSpec(type);
  const baseLower = base.toLowerCase();
  const lengthTypes = new Set(['varchar', 'char', 'varbinary', 'binary']);
  const precisionTypes = new Set(['decimal', 'numeric']);

  if (!args.length || (!lengthTypes.has(baseLower) && !precisionTypes.has(baseLower))) {
    await db.schema.alterTable(tableName).addColumn(columnName, base).execute();
    return;
  }

  await db.schema
    .alterTable(tableName)
    .addColumn(columnName, base, (col) => {
      let c = col;
      if (lengthTypes.has(baseLower)) {
        const len = Number(args[0]);
        if (Number.isFinite(len) && typeof c.length === 'function') {
          c = c.length(len);
        }
        return c;
      }

      if (precisionTypes.has(baseLower)) {
        const precision = Number(args[0]);
        const scale = Number(args[1]);
        if (Number.isFinite(precision) && typeof c.precision === 'function') {
          if (Number.isFinite(scale)) {
            c = c.precision(precision, scale);
          } else {
            c = c.precision(precision);
          }
        }
        return c;
      }

      return c;
    })
    .execute();
}

async function testAddColumn(db, vendorName, type) {
  const tableName = buildTempTableName(type);
  try {
    await db.schema
      .createTable(tableName)
      .addColumn('id', 'integer', col => col.primaryKey())
      .execute();
    await addColumnWithVendor(db, tableName, 'test_col', type, vendorName);
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
