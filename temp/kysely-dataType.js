import { Kysely, SqliteDialect, PostgresDialect, MysqlDialect, MssqlDialect } from 'kysely';
import Database from 'better-sqlite3';
import mysql from 'mysql2';
// import mssql from 'mssql';
import * as tedious from 'tedious'
import * as tarn from 'tarn'


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

const MSSQL_CONFIG = {
    user: process.env.MSSQL2022_USER ?? 'sa',
    password: process.env.MSSQL2022_PASSWORD ?? 'Your_password123',
    server: process.env.MSSQL2022_HOST ?? '127.0.0.1',
    port: Number(process.env.MSSQL2022_PORT ?? '1435'),
    database: process.env.MSSQL2022_DB ?? 'mydb',
    trustServerCertificate: true,
    enableArithAbort: true,
    pool: {
        max: 5,
        min: 0,
        idleTimeoutMillis: 30000
    }
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
    {
      name: 'sqlite',
      types: [
          'varchar', 'char', 'text', 'integer', 'int2', 'int4', 'int8', 'smallint', 'bigint', 'boolean', 'real',
          'double precision', 'float4', 'float8', 'decimal', 'numeric', 'binary', 'bytea', 'date', 'datetime',
          'time', 'timetz', 'timestamp', 'timestamptz', 'serial', 'bigserial', 'uuid', 'json', 'jsonb', 'blob',
          'varbinary', 'int4range', 'int4multirange', 'int8range', 'int8multirange', 'numrange', 'nummultirange',
          'tsrange', 'tsmultirange', 'tstzrange', 'tstzmultirange', 'daterange', 'datemultirange',
          'varchar(255)', 'char(10)', 'decimal(10, 2)', 'numeric(10, 2)', 'binary(16)', 'datetime(3)',
          'time(3)', 'timetz(3)', 'timestamp(3)', 'timestamptz(3)', 'varbinary(255)'
      ],
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
      name: 'mysql',
      types: [
          'varchar', 'char', 'text', 'integer', 'int2', 'int4', 'int8', 'smallint', 'bigint', 'boolean', 'real',
          'double precision', 'float4', 'float8', 'decimal', 'numeric', 'binary', 'bytea', 'date', 'datetime',
          'time', 'timetz', 'timestamp', 'timestamptz', 'serial', 'bigserial', 'uuid', 'json', 'jsonb', 'blob',
          'varbinary', 'int4range', 'int4multirange', 'int8range', 'int8multirange', 'numrange', 'nummultirange',
          'tsrange', 'tsmultirange', 'tstzrange', 'tstzmultirange', 'daterange', 'datemultirange',
          'varchar(255)', 'char(10)', 'decimal(10, 2)', 'numeric(10, 2)', 'binary(16)', 'datetime(3)',
          'time(3)', 'timetz(3)', 'timestamp(3)', 'timestamptz(3)', 'varbinary(255)'
      ],
      // 안되는 타입 : mysql 8016 기준
      // varchar, bytea, timetz, timestamptz, bigserial, uuid, jsonb
      // varbinary, int4range, 'int4multirange', 'int8range', 'int8multirange', 'numrange', 'nummultirange',
      // tsrange', 'tsmultirange', 'tstzrange', 'tstzmultirange', 'daterange', 'datemultirange',
      // 'timetz(3)', 'timestamptz(3)'
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
    {
      name: 'postgres',
      types: [
          'varchar', 'char', 'text', 'integer', 'int2', 'int4', 'int8', 'smallint', 'bigint', 'boolean', 'real',
          'double precision', 'float4', 'float8', 'decimal', 'numeric', 'binary', 'bytea', 'date', 'datetime',
          'time', 'timetz', 'timestamp', 'timestamptz', 'serial', 'bigserial', 'uuid', 'json', 'jsonb', 'blob',
          'varbinary', 'int4range', 'int4multirange', 'int8range', 'int8multirange', 'numrange', 'nummultirange',
          'tsrange', 'tsmultirange', 'tstzrange', 'tstzmultirange', 'daterange', 'datemultirange',
          'varchar(255)', 'char(10)', 'decimal(10, 2)', 'numeric(10, 2)', 'binary(16)', 'datetime(3)',
          'time(3)', 'timetz(3)', 'timestamp(3)', 'timestamptz(3)', 'varbinary(255)'
      ],
      // 안되는 타입 : postgres 15 기준
      // binary, datetime, blob, varbinary,
      // 'binary(16)', 'datetime(3)', 'varbinary(255)'
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
      name: 'mssql',
      types: [
          'varchar', 'char', 'text', 'integer', 'int2', 'int4', 'int8', 'smallint', 'bigint', 'boolean', 'real',
          'double precision', 'float4', 'float8', 'decimal', 'numeric', 'binary', 'bytea', 'date', 'datetime',
          'time', 'timetz', 'timestamp', 'timestamptz', 'serial', 'bigserial', 'uuid', 'json', 'jsonb', 'blob',
          'varbinary', 'int4range', 'int4multirange', 'int8range', 'int8multirange', 'numrange', 'nummultirange',
          'tsrange', 'tsmultirange', 'tstzrange', 'tstzmultirange', 'daterange', 'datemultirange',
          'varchar(255)', 'char(10)', 'decimal(10, 2)', 'numeric(10, 2)', 'binary(16)', 'datetime(3)',
          'time(3)', 'timetz(3)', 'timestamp(3)', 'timestamptz(3)', 'varbinary(255)'
      ],
      // 안되는 타입 : mssql 2022 기준
      // int2, int4, int8, boolean, float4, float8, bytea, timetz, timestamp, timestamptz,
      // serial, bigserial, uuid, json, jsonb, blob,
      // int4range, int4multirange, int8range, int8multirange, numrange, nummultirange,
      // tsrange, tsmultirange, tstzrange, tstzmultirange, daterange, datemultirange,
      // datetime(3), timetz(3), timestamp(3), timestamptz(3)
      init: async () => {
          // const pool = new mssql.ConnectionPool(MSSQL_CONFIG);
          // await pool.connect();
          const dialectConfig = {
              tarn: {
                  ...tarn,
                  options: {
                      min: 0,
                      max: 10,
                  },
              },
              tedious: {
                  ...tedious,
                  connectionFactory: () => new tedious.Connection({
                      authentication: {
                          options: {
                              password: 'Your_password123',
                              userName: 'sa',
                          },
                          type: 'default',
                      },
                      options: {
                          database: 'mydb',
                          port: 1435,
                          trustServerCertificate: true,
                      },
                      server: 'localhost',
                  }),
              },
          }
          const db = new Kysely({
            dialect: new MssqlDialect(dialectConfig),
           });
          return {
              db,
              async dispose() {
                  await db.destroy();
                  // await pool.close();
              },
          };
      },
    }
];

// 전체 자료형 나열 (중복 제거)
const allTypes = Array.from(
    new Set(
        vendorDefinitions.flatMap(v => v.types)
    )
);
console.log('전체 자료형:', allTypes);

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

    // if (vendor.name !== 'sqlite') continue
    // if (vendor.name !== 'mysql') continue
    if (vendor.name !== 'mssql') continue
    // if (vendor.name !== 'postgres') continue
    
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
