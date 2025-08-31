import { SQLContext } from '../src/sql-context.js';
import { sto_master } from './sto-master.table.js';

const ctx_sto_core = new SQLContext();

ctx_sto_core.tables.add(sto_master);
// ctx_sto_core.addTable(sto_master);

export default ctx_sto_core;
export { ctx_sto_core };
