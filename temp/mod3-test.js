import ctx_prt_core from './prt-core.index.js';

import { viewTable } from './view-table.js';

// #################################
// DB 연결 설정
import { SqliteDialect } from 'kysely'
import Database from 'better-sqlite3'


import { PrefixSuffixPlugin } from '../src/plugin/prefix-suffix.js';

ctx_prt_core.connect = {
    dialect: new SqliteDialect({
        // database: new Database(':memory:')
        database: new Database('mydb.sqlite')  // 로컬에 파일로 생성
    }),
    plugins: [ 
        new PrefixSuffixPlugin({
            tablePrefix: 'pre_',
            tableSuffix: '_suf',
            tableMap: { sto_master: 't_store' },
            excludeTables: ['sqlite_master', /^sqlite_/i]
        })
    ]
};

// #################################
ctx_prt_core.tables['prt_master'].columns.add('prt_description', { dataType: 'text', nullable: true });
ctx_prt_core.tables['prt_master'].columns.add('created_at', { dataType: 'datetime', defaultValue: 'CURRENT_TIMESTAMP' });
ctx_prt_core.tables['prt_master'].columns.add('updated_at', { dataType: 'datetime', nullable: true });

// #################################

await ctx_prt_core.init();

// await ctx_prt_core.validateDefinition(); // 실제 DB에 반영하기 전에 정의 검사
// await ctx_prt_core.validateDefinition(ctx_prt_core.connect); // 임시 DB 연결로 검사 
await ctx_prt_core.validateDefinition({
    dialect: new SqliteDialect({
        // database: new Database(':memory:')
        database: new Database('validate.sqlite')  // 로컬에 파일로 생성
    }),
    plugins: [ 
        new PrefixSuffixPlugin({
            tablePrefix: 'pre_',
            tableSuffix: '_suf',
            tableMap: { sto_master: 't_store' },
            excludeTables: ['sqlite_master', /^sqlite_/i]
        })
    ]
}); // 임시 DB 연결로 검사 

try {
    await ctx_prt_core.createSchema();
    await viewTable(ctx_prt_core.db, '정상적인 테이블 목록');

} catch (error) {
    console.error('Error creating schema:', error);
    await viewTable(ctx_prt_core.db, 'Error 발생 시 테이블 목록');
}

await ctx_prt_core.db.insertInto('prt_master')
  .values({ prt_name: 'Logic Store' })
  .execute();
await ctx_prt_core.db.insertInto('prt_master')
  .values({ prt_name: 'Logic Store2' })
  .execute();  
const sto_master2 = await ctx_prt_core.db.selectFrom('prt_master')
  .selectAll()
  .execute();
// console.log('prt_master:', sto_master2);
sto_master2.forEach(row => {console.log('prt_master row:', row);});

const maxId = await ctx_prt_core.qry['getMaxPrtId']();
console.log('Max prt_id:', maxId);

const maxId2 = await ctx_prt_core.qry['getMaxPrtId2']();
console.log('Max prt_id2:', maxId2);


import { detectAndStoreDbInfo } from '../src/util/db-info.js';

const info = await detectAndStoreDbInfo(ctx_prt_core);
console.log('info ', info);

import { transformSqlNames } from '../src/util/transform-sql-name.js';

const opts = {
  tableMap: { sto_master: 't_store' },
  tablePrefix: 'pre_',
  tableSuffix: '_suf',
};

// const sql = 'SELECT prt_id, prt_name FROM prt_master WHERE prt_id > 0';
const sql = `
        SELECT MAX("prt_id") AS "max_prt_id"
        FROM "prt_master";
    `;
const result = transformSqlNames(sql, opts);
console.log(result);

const sql2 = 'SELECT prt_id, prt_name FROM sto_master WHERE prt_id > 0';
const result2 = transformSqlNames(sql2, opts);
console.log(result2);

const sql3 = 'SELECT prt_id, prt_name FROM pre_prt_master_suf WHERE prt_id > 0';
const result3 = transformSqlNames(sql3, opts);
console.log(result3);

// 매핑된 테이블/컬럼은 그대로, 나머지는 prefix/suffix 적용

console.log(0);
