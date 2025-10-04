import { SQLContext } from '../../../src/sql-context.js';
import { ctx_sto_core } from '../sto-core/index.js';

const ctx_sto_account = new SQLContext('sto_account');

ctx_sto_account.contexts.add(ctx_sto_core);
ctx_sto_account.tables.add('sto_account');

// Primary key column
ctx_sto_account.tables['sto_account'].columns.add('acc_idx', {
    pk: true,
    autoIncrement: true,
    isDynamic: false,
    dataType: 'int'
});
// Foreign key column
ctx_sto_account.tables['sto_account'].columns.add('sto_id', {
    fk: 'sto_master.sto_id',
    nullable: false,
    isDynamic: false,
    dataType: 'varchar(10)',
    kind: ['C'],
    placeholder: 'Enter Store ID'
});
ctx_sto_account.tables['sto_account'].columns.add('admin_id', {
    unique: true,
    nullable: false,
    isDynamic: false,
    dataType: 'varchar(50)',
    kind: ['C'],
    placeholder: 'Enter Admin ID'
});
ctx_sto_account.tables['sto_account'].columns.add('admin_pw', {
    nullable: false,
    isDynamic: false,
    dataType: 'varchar(50)',
    kind: ['C', 'U'],
    placeholder: 'Enter Admin Password'
});
ctx_sto_account.tables['sto_account'].columns.add('admin_name', {
    nullable: false,
    isDynamic: false,
    dataType: 'varchar(100)',
    kind: ['C', 'U'],
    placeholder: 'Enter Admin Name'
});
ctx_sto_account.tables['sto_account'].columns.add('use_yn', {
    nullable: false,
    dataType: 'char(1)',
    isDynamic: false,
    defaultValue: 'Y',
    kind: ['C', 'U'],
    placeholder: 'Use Y/N'
});
ctx_sto_account.tables['sto_account'].columns.add('create_dt', {
    nullable: false,
    dataType: 'timestamp',
    isDynamic: false,
    defaultValue: { kind: 'now' }
});
ctx_sto_account.tables['sto_account'].columns.add('update_dt', {
    nullable: false,
    dataType: 'timestamp',
    isDynamic: false,
    defaultValue: { kind: 'now' }
});
ctx_sto_account.tables['sto_account'].columns.add('del_yn', {
    nullable: false,
    dataType: 'char(1)',
    isDynamic: false,
    defaultValue: 'N'
});

export default ctx_sto_account;
export { ctx_sto_account };
