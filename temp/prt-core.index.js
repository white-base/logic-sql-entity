import { SQLContext } from '../src/sql-context.js';
import { prt_master } from './prt-master.table.js';
import ctx_sto_core from './sto-core.index.js';
import { sql } from 'kysely';
import { transformSqlNames } from '../src/util/transform-sql-name.js';

const ctx_prt_core = new SQLContext('prt_core');
// ctx_prt_core.addTable(prt_master);
ctx_prt_core.contexts.add('sto_core', ctx_sto_core);
ctx_prt_core.tables.add(prt_master);


ctx_prt_core.qry.add('getMaxPrtId', async () => {
  const row = await ctx_prt_core.db
    .selectFrom('prt_master')
    .select((eb) => [eb.fn.max('prt_id').as('max_prt_id')])
    .executeTakeFirst();

  return row?.max_prt_id ?? null;
});

ctx_prt_core.qry.add('getMaxPrtId2', async () => {
    // const result = await sql`
    //     SELECT MAX("prt_id") AS "max_prt_id"
    //     FROM "pre_prt_master_suf";
    // `.execute(ctx_prt_core.db);

    let query = `
        SELECT MAX("prt_id") AS "max_prt_id"
        FROM "prt_master";
    `;
    query = transformSqlNames(query, {
      // tableMap: { prt_master: 't_prt' },
      tableMap: { sto_master: 't_store' },
      tablePrefix: 'pre_',
      tableSuffix: '_suf',
    });

    const result = await sql.raw(query).execute(ctx_prt_core.db);
    // const result = await sql`${query}`.execute(ctx_prt_core.db);

    // const result = await ctx_prt_core.db.raw(query).execute();
    // const result = await ctx_prt_core.db.executeQuery(q.compile(ctx.db));
    //   return row?.max_prt_id ?? null;
    return result?.rows?.[0]?.max_prt_id ?? null;
});


export default ctx_prt_core;
export { ctx_prt_core };
