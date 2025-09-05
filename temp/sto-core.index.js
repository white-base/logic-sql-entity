import { SQLContext } from '../src/sql-context.js';
import { sto_master } from './sto-master.table.js';

const ctx_sto_core = new SQLContext('sto_core');

ctx_sto_core.tables.add(sto_master);
// ctx_sto_core.addTable(sto_master);

// 재정의
ctx_sto_core.tables.insert = function() {
    console.log('...');
    
}

export default ctx_sto_core;
export { ctx_sto_core };
