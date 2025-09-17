import { SQLTable } from '../src/sql-table.js';

const sto_master = new SQLTable('sto_master');

// sto_master.columns.addValue('sot_id', { pk: true });
sto_master.columns.add('sto_id');
sto_master.columns.add('sto_name');

sto_master.columns['sto_id'].dataType = 'int';
sto_master.columns['sto_id'].pk = true;

sto_master.columns['sto_name'].dataType = 'text';

export default sto_master;
export { sto_master };