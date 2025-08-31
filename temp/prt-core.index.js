import { SQLContext } from '../src/sql-context.js';
import { prt_master } from './prt-master.table.js';
import ctx_sto_core from './sto-core.index.js';

const ctx_prt_core = new SQLContext();
// ctx_prt_core.addTable(prt_master);
ctx_prt_core.contexts.add('sto_core', ctx_sto_core);

export default ctx_prt_core;
export { ctx_prt_core };
