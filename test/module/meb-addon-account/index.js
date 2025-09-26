import { SQLContext } from '../../../src/sql-context.js';
import { ctx_meb_core } from '../meb-core/index.js';
import { ctx_sto_account } from '../sto-addon-account/index.js';

const ctx_meb_account = new SQLContext('meb_account');

ctx_meb_account.contexts.add(ctx_meb_core);
ctx_meb_account.contexts.add(ctx_sto_account);
ctx_meb_account.tables.add('meb_account');

ctx_meb_account.tables['meb_account'].columns.add('meb_idx', 
    { pk: true, fk: 'meb_master.meb_idx', dataType: 'int' }
);
ctx_meb_account.tables['meb_account'].columns.add('sto_id', 
    { fk: 'sto_master.sto_id', nullable: false, dataType: 'varchar(10)' }
);// REVIEW: 테스트 용도
ctx_meb_account.tables['meb_account'].columns.add('id', 
    { unique: true, nullable: false, dataType: 'varchar(50)' }
);
ctx_meb_account.tables['meb_account'].columns.add('pw', 
    { nullable: false, dataType: 'varchar(50)' }
);
ctx_meb_account.tables['meb_account'].columns.add('update_dt', 
    { nullable: false, dataType: 'timestamp' }
);

export default ctx_meb_account;
export { ctx_meb_account };
