import { SQLContext } from '../../../src/sql-context.js';

const ctxStore = new SQLContext('sto_core');

ctxStore.tables.add('sto_master');

ctxStore.tables['sto_master'].columns.add('sto_id', { 
    pk: true,
    nullable: false,
    dataType: 'varchar(10)',
    isDynamic: false,
    visible: true,
    kind: ['C'],
    placeholder: 'Enter Store ID'
});
ctxStore.tables['sto_master'].columns.add('sto_name', { 
    nullable: false,
    dataType: 'varchar(100)',
    isDynamic: false,
    visible: true,
    kind: ['C'],
    placeholder: 'Enter Store Name'
});
ctxStore.tables['sto_master'].columns.add('status_cd', { 
    nullable: false,
    dataType: 'char(2)',
    isDynamic: false,
    visible: true,
    kind: ['C'],
    placeholder: 'Enter Status Code'
});
ctxStore.tables['sto_master'].columns.add('create_dt', { 
    nullable: false,
    dataType: 'timestamp',
    defaultValue: { kind: 'now' },
    isDynamic: false,
    visible: true,
});
ctxStore.tables['sto_master'].columns.add('update_dt', { 
    dataType: 'timestamp',
    isDynamic: false,
    visible: false
});
ctxStore.tables['sto_master'].columns.add('del_yn', { 
    nullable: false,
    dataType: 'char(1)',
    defaultValue: 'N',
    isDynamic: false,
    visible: false
});

export default ctxStore;
export { ctxStore };
