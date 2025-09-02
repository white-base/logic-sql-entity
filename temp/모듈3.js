import ctx_prt_core from './prt-core.index.js';

// #################################
// DB 연결 설정
import { SqliteDialect } from 'kysely'
import Database from 'better-sqlite3'


import { PrefixSuffixPlugin } from '../src/plugin/prefix-suffix.js';

ctx_prt_core.connect = {
    dialect: new SqliteDialect({
        database: new Database(':memory:')
    }),
    plugins: [ 
        new PrefixSuffixPlugin({
            tablePrefix: 'pre_',
            tableSuffix: '_suf',
            columnPrefix: 'c_',
            columnSuffix: '_x',
            tableMap: { sto_master: 't_store' },
            columnMap: { sto_master: { sto_name: 'store_name' }},
            excludeTables: ['sqlite_master', /^sqlite_/i]
        })
    ]
};
// #################################

await ctx_prt_core.init();

await ctx_prt_core.createSchema();
console.log(ctx_prt_core);

import { Kysely } from 'kysely';
const dbNoPlugin = new Kysely({ dialect: ctx_prt_core.connect.dialect });
const tables = await dbNoPlugin
  .selectFrom('sqlite_master')
  .select(['name', 'type'])
  .where('type', '=', 'table')
  .execute();
console.log('Tables:', tables);


await ctx_prt_core.db
  .insertInto('prt_master')
  .values({ prt_name: 'Logic Store' })
  .execute();
await ctx_prt_core.db
  .insertInto('prt_master')
  .values({ prt_name: 'Logic Store2' })
  .execute();  
const sto_master2 = await ctx_prt_core.db
  .selectFrom('prt_master')
  .select(['prt_name', 'prt_id'])
  .execute();
console.log('prt_master:', sto_master2[0]);

const maxId = await ctx_prt_core.qry['getMaxPrtId']();
console.log('Max prt_id:', maxId);

const maxId2 = await ctx_prt_core.qry['getMaxPrtId2']();
console.log('Max prt_id2:', maxId2);


import { detectAndStoreDbInfo } from '../src/util/db-info.js';

const info = await detectAndStoreDbInfo(ctx_prt_core);
console.log('info ', info);

import { transformSqlNames } from '../src/util/transform-sql-name.js';

const opts = {
  tableMap: { prt_master: 't_prt' },
  columnMap: { prt_master: { prt_name: 'name' } },
  tablePrefix: 'pre_',
  tableSuffix: '_suf',
  columnPrefix: 'c_',
  columnSuffix: '_x'
};

const sql = 'SELECT prt_id, prt_name FROM prt_master WHERE prt_id > 0';
const result = transformSqlNames(sql, opts);
console.log(result);

const sql2 = 'SELECT prt_id, prt_name FROM sto_master WHERE prt_id > 0';
const result2 = transformSqlNames(sql2, opts);
console.log(result2);

// 매핑된 테이블/컬럼은 그대로, 나머지는 prefix/suffix 적용

console.log(0);
