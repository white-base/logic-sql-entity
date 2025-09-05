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


await ctx_prt_core.createSchema();
console.log(ctx_prt_core);

import { Kysely } from 'kysely';
const dbNoPlugin = new Kysely({ dialect: ctx_prt_core.connect.dialect });
const tables = await dbNoPlugin
  .selectFrom('sqlite_master')
  .select(['name', 'type'])
  .where('type', '=', 'table')
  .execute();
console.log('Tables:', tables[0]);

await ctx_prt_core.db
  .insertInto('sto_master')
  .values({ sto_name: 'Logic Store' })
  .execute();
const sto_master2 = await ctx_prt_core.db
  .selectFrom('sto_master')
  .select(['sto_name', 'sto_id'])
  .execute();
console.log('sto_master2:', sto_master2[0]);

await ctx_prt_core.db
  .insertInto('prt_master')
  .values({ prt_name: 'Logic Store' })
  .execute();
const sto_master3 = await ctx_prt_core.db
  .selectFrom('prt_master')
  .select(['prt_name', 'prt_id'])
  .execute();
console.log('sto_master3:', sto_master3[0]);

for(const aa in ctx_prt_core.tables) {
  console.log('tables: ' + aa);
}

for(const aa in ctx_prt_core.tables[0].cols) {
  console.log('cols: ', aa);
}

ctx_prt_core.tables[0].rows.add({ prt_name: 'Another Store', prt_id: 2 });

for(const aa in ctx_prt_core.tables[0].rows) {
  console.log('rows: ', aa);
}

for(const aa in ctx_prt_core.tables[0].rows[0]) {
  console.log('row: ', aa);
}

for(const aa in ctx_prt_core.tables[0].cols[0]) {
  console.log('col[0]: ', aa);
}


for(const aa of ctx_prt_core.tables.entries()) {
  console.log('tables: ' + aa);
}

for(const [i, aa] of ctx_prt_core.tables.entries()) {
  console.log('tables: ' + aa + ' (index: ' + i + ')');
}


// for(const aa of ctx_prt_core.tables) {
//   console.log(aa);
// }

for (const v of [10, 20, 30]) {
  console.log(v);
}

// 인덱스가 필요하면
for (const [i, v] of [10, 20, 30].entries()) {
  console.log(i, v);
}


console.log(0);
