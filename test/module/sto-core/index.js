import { SQLContext } from '../../../src/sql-context.js';

const ctx_sto_core = new SQLContext('sto_core');

ctx_sto_core.tables.add('sto_master');

ctx_sto_core.tables['sto_master'].columns.add('sto_id', { 
    pk: true, nullable: false, dataType: 'varchar(10)', 
    isDynamic: false, visible: true, kind: ['C'] 
});
ctx_sto_core.tables['sto_master'].columns.add('sto_name', { 
    nullable: false, dataType: 'varchar(100)', 
    isDynamic: false, visible: true, kind: ['C'] 
});
ctx_sto_core.tables['sto_master'].columns.add('status_cd', { 
    nullable: false, dataType: 'char(2)', 
    isDynamic: false, visible: true, kind: ['C'] 
});
ctx_sto_core.tables['sto_master'].columns.add('create_dt', { 
    nullable: false, dataType: 'timestamp', 
    defaultValue: { kind: 'now' }, isDynamic: false, visible: true 
});
ctx_sto_core.tables['sto_master'].columns.add('update_dt', { 
    dataType: 'timestamp', isDynamic: false, visible: false 
});
ctx_sto_core.tables['sto_master'].columns.add('del_yn', { 
    nullable: false, dataType: 'char(1)', defaultValue: 'N', 
    isDynamic: false, visible: false 
});

export default ctx_sto_core;
export { ctx_sto_core };
