import { SQLContext } from '../src/sql-context.js';
import { prt_master } from './prt-master.table.js';
import ctx_sto_core from './sto-core.index.js';
import { sql } from 'kysely';

const ctx_prt_core = new SQLContext();
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
    const row = await sql`
        SELECT MAX("c_prt_id_x") AS "max_prt_id"
        FROM "pre_prt_master_suf";
    `.execute(ctx_prt_core.db);

//   return row?.max_prt_id ?? null;
  return row?.rows?.[0]?.max_prt_id ?? null;
});


export default ctx_prt_core;
export { ctx_prt_core };
