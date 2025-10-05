import { SQLContext } from '../../../src/sql-context.js';
import { ctxMember } from '../meb-core/index.js';
import { ctxStoAccount } from '../sto-addon-account/index.js';

const ctxMebAccount = new SQLContext('meb_account');

ctxMebAccount.contexts.add(ctxMember);
ctxMebAccount.contexts.add(ctxStoAccount);
ctxMebAccount.tables.add('meb_account');

ctxMebAccount.tables['meb_account'].columns.add('meb_idx', 
    { pk: true, fk: 'meb_master.meb_idx', dataType: 'int' }
);
ctxMebAccount.tables['meb_account'].columns.add('sto_id', 
    { fk: 'sto_master.sto_id', nullable: false, dataType: 'varchar(10)' }
);// REVIEW: 테스트 용도
ctxMebAccount.tables['meb_account'].columns.add('id', 
    { unique: true, nullable: false, dataType: 'varchar(50)' }
);
ctxMebAccount.tables['meb_account'].columns.add('pw', 
    { nullable: false, dataType: 'varchar(50)' }
);
ctxMebAccount.tables['meb_account'].columns.add('update_dt', 
    { nullable: false, dataType: 'timestamp' }
);

export default ctxMebAccount;
export { ctxMebAccount };
