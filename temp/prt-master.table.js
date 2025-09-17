import { SQLTable } from '../src/sql-table.js';

const prt_master = new SQLTable('prt_master');

// prt_master.columns.addValue('prt_id', { pk: true });
prt_master.columns.add('prt_id');
prt_master.columns.add('prt_name');


prt_master.columns['prt_id'].dataType = 'int';
prt_master.columns['prt_id'].pk = true;

prt_master.columns['prt_name'].dataType = 'text';
prt_master.columns['prt_name'].indexes = ['g1'];
export default prt_master;
export { prt_master };