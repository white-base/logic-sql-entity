import ctx_sto_core from './sto-core.index.js';

// #################################
// DB 연결 설정
import { SqliteDialect } from 'kysely'
import Database from 'better-sqlite3'
import { NamingResolver, CombinedNamingPlugin } from '../src/plugin/naming-resolver.js'

const resolver = new NamingResolver({
  tableMap: { sto_master: 't_store' },            // 절대 매핑
  perTableColumnMap: { sto_master: { sto_name: 'store_name' } },
  tablePrefix: '', tableSuffix: '',               // 매핑된 이름 그대로 사용
  columnPrefix: '',  columnSuffix: '',
  allowAffixOnMapped: false,
})

ctx_sto_core.connect = {
    dialect: new SqliteDialect({
        database: new Database(':memory:')
    }),
    plugins: [ new CombinedNamingPlugin(resolver) ]
};


// #################################

await ctx_sto_core.createSchema();

console.log(ctx_sto_core);

const tables = await ctx_sto_core.db
  .selectFrom('sqlite_master')
  .select(['name', 'type'])
  .where('type', '=', 'table')
  .execute();

console.log('Tables:', tables);

// 데이터 삽입
import { sql } from 'kysely';

await ctx_sto_core.db
  .insertInto('sto_master')
  .values({ sto_name: 'Logic Store' })
  .execute();

// 데이터 조회
const sto_master = await sql`
  SELECT sto_name
  FROM sto_master
`.execute(ctx_sto_core.db);

console.log('sto_master:', sto_master.rows);

console.log(0);



// expo