import { SQLContext } from '../../../src/sql-context.js';
import { ctx_sto_core } from '../sto-core/index.js';

const ctx_sto_account = new SQLContext('sto_account');

ctx_sto_account.contexts.add(ctx_sto_core);
ctx_sto_account.tables.add('sto_account');

ctx_sto_account.tables['sto_account'].columns.add('acc_idx', 
    { pk: true, autoIncrement: true, dataType: 'int' }
);
ctx_sto_account.tables['sto_account'].columns.add('sto_id', 
    { fk: 'sto_master.sto_id', nullable: false, dataType: 'varchar(10)' }
);
ctx_sto_account.tables['sto_account'].columns.add('admin_id', 
    { unique: true, nullable: false, dataType: 'varchar(50)' }
);
ctx_sto_account.tables['sto_account'].columns.add('admin_pw', 
    { nullable: false, dataType: 'varchar(50)' }
);
ctx_sto_account.tables['sto_account'].columns.add('admin_name', 
    { nullable: false, dataType: 'varchar(100)' }
);
ctx_sto_account.tables['sto_account'].columns.add('use_yn', 
    { nullable: false, dataType: 'char(1)', defaultValue: 'Y' }
);
ctx_sto_account.tables['sto_account'].columns.add('create_dt', 
    { nullable: false, dataType: 'timestamp', defaultValue: { kind: 'now' } }
);
ctx_sto_account.tables['sto_account'].columns.add('update_dt', 
    { nullable: false, dataType: 'timestamp' }
);
ctx_sto_account.tables['sto_account'].columns.add('del_yn', 
    { nullable: false, dataType: 'char(1)', defaultValue: 'N' }
);

export default ctx_sto_account;
export { ctx_sto_account };
