import ctx_sto_core from './sto-core.index.js';

// #################################
// DB 연결 설정
import { SqliteDialect } from 'kysely'
import Database from 'better-sqlite3'



// import { NamingResolver, CombinedNamingPlugin } from '../src/plugin/naming-resolver.js'

// const resolver = new NamingResolver({
//   tableMap: { sto_master: 't_store' },            // 절대 매핑
//   perTableColumnMap: { sto_master: { sto_name: 'store_name' } },
//   tablePrefix: '', tableSuffix: '',               // 매핑된 이름 그대로 사용
//   columnPrefix: '',  columnSuffix: '',
//   allowAffixOnMapped: false,
// })

// ctx_sto_core.connect = {
//     dialect: new SqliteDialect({
//         database: new Database(':memory:')
//     }),
//     plugins: [ new CombinedNamingPlugin(resolver) ]
// };


// ctx_sto_core.connect = {
//     dialect: new SqliteDialect({
//         database: new Database(':memory:')
//     })
// };

import { PrefixSuffixPlugin } from '../src/plugin/prefix-suffix.js';

ctx_sto_core.connect = {
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

await ctx_sto_core.createSchema();

console.log(ctx_sto_core);


import { Kysely } from 'kysely';
const dbNoPlugin = new Kysely({ dialect: ctx_sto_core.connect.dialect });
const tables = await dbNoPlugin
  .selectFrom('sqlite_master')
  .select(['name', 'type'])
  .where('type', '=', 'table')
  .execute();
console.log('Tables:', tables);

// const tables = await ctx_sto_core.db
//   .selectFrom('sqlite_master')
//   .select(['name', 'type'])
//   .where('type', '=', 'table')
//   .execute();
// console.log('Tables:', tables);

// const tables = await ctx_sto_core.db
//   .selectFrom('sqlite_master')
//   .select(['c_name', 'c_type']) // prefix가 붙은 컬럼명 시도
//   .where('type', '=', 'table')
//   .execute();


// 데이터 삽입
// import { sql } from 'kysely';

await ctx_sto_core.db
  .insertInto('sto_master')
  .values({ sto_name: 'Logic Store' })
  .execute();
const sto_master2 = await ctx_sto_core.db
  .selectFrom('sto_master')
  .select(['sto_name', 'sto_id'])
  .execute();
console.log('sto_master2:', sto_master2);


// 데이터 조회
// const sto_master = await sql`
//   SELECT sto_name
//   FROM sto_master
// `.execute(ctx_sto_core.db);

// console.log('sto_master:', sto_master.rows);



console.log(0);



// export default ctx_sto_core;