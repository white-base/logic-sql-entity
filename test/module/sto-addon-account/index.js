import { SQLContext } from '../../../src/sql-context.js';
import { ctxStore } from '../sto-core/index.js';

const ctxStoAccount = new SQLContext('sto_account');

ctxStoAccount.contexts.add(ctxStore);
ctxStoAccount.tables.add('sto_account');

// Primary key column
ctxStoAccount.tables['sto_account'].columns.add('acc_idx', {
    pk: true,
    autoIncrement: true,
    isDynamic: false,
    dataType: 'int'
});
// Foreign key column
ctxStoAccount.tables['sto_account'].columns.add('sto_id', {
    fk: 'sto_master.sto_id',
    nullable: false,
    isDynamic: false,
    dataType: 'varchar(10)',
    kind: ['C'],
    placeholder: 'Enter Store ID'
});
ctxStoAccount.tables['sto_account'].columns.add('admin_id', {
    unique: true,
    nullable: false,
    isDynamic: false,
    dataType: 'varchar(50)',
    kind: ['C'],
    placeholder: 'Enter Admin ID'
});
ctxStoAccount.tables['sto_account'].columns.add('admin_pw', {
    nullable: false,
    isDynamic: false,
    dataType: 'varchar(50)',
    kind: ['C', 'U'],
    placeholder: 'Enter Admin Password'
});
ctxStoAccount.tables['sto_account'].columns.add('admin_name', {
    nullable: false,
    isDynamic: false,
    dataType: 'varchar(100)',
    kind: ['C', 'U'],
    placeholder: 'Enter Admin Name'
});
ctxStoAccount.tables['sto_account'].columns.add('use_yn', {
    nullable: false,
    dataType: 'char(1)',
    isDynamic: false,
    defaultValue: 'Y',
    kind: ['C', 'U'],
    placeholder: 'Use Y/N'
});
ctxStoAccount.tables['sto_account'].columns.add('create_dt', {
    nullable: false,
    dataType: 'timestamp',
    isDynamic: false,
    defaultValue: { kind: 'now' }
});
ctxStoAccount.tables['sto_account'].columns.add('update_dt', {
    nullable: false,
    dataType: 'timestamp',
    isDynamic: false,
    defaultValue: { kind: 'now' }
});
ctxStoAccount.tables['sto_account'].columns.add('del_yn', {
    nullable: false,
    dataType: 'char(1)',
    isDynamic: false,
    defaultValue: 'N'
});

ctxStoAccount.tables['sto_account'].create = async function(p_options) {
    // POINT: 부모 클래스의 create 메서드 호출
    
    const parentCreate = Object.getPrototypeOf(this).create;
    // const parentCreate = this.__proto__.create;
    if (typeof parentCreate === 'function') {
        const result = await parentCreate.call(this, p_options);
        console.log('override create method in sto_account table');
        return result;
    }
    throw new Error('Parent create method not found');
};

export default ctxStoAccount;
export { ctxStoAccount };
