import { transformSqlNames } from '../src/util/transform-sql-name.js';

const sql = `
SELECT MAX("prt_id") AS "max_prt_id"
FROM "prt_master";
`;

const out1 = transformSqlNames(sql, { tablePrefix: 'pre_', tableSuffix: '_suf' });
console.log('Affix only =>\n', out1);

const out2 = transformSqlNames(sql, { tablePrefix: 'pre_', tableSuffix: '_suf', tableMap: { prt_master: 't_prt' } });
console.log('With tableMap =>\n', out2);

