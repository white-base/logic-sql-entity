import { SQLContext } from '../../../src/sql-context.js';
import { ctxStore } from '../sto-core/index.js';

const ctxMember = new SQLContext('meb_core');

ctxMember.contexts.add(ctxStore);
ctxMember.tables.add('meb_master');

ctxMember.tables['meb_master'].columns.add('meb_idx', 
    { primaryKey: true, autoIncrement: true, dataType: 'int' }
);
ctxMember.tables['meb_master'].columns.add('sto_id', 
    { fk: 'sto_master.sto_id', dataType: 'varchar(10)', nullable: false }
);
ctxMember.tables['meb_master'].columns.add('meb_name',
    { nullable: false, dataType: 'varchar(100)', nullable: false }
);
ctxMember.tables['meb_master'].columns.add('status_cd',
    { nullable: false, dataType: 'char(2)', nullable: false }
);
ctxMember.tables['meb_master'].columns.add('create_dt',
    { nullable: false, dataType: 'timestamp', defaultValue: { kind: 'now' } }
);
ctxMember.tables['meb_master'].columns.add('update_dt',
    { nullable: false, dataType: 'timestamp' }
);
ctxMember.tables['meb_master'].columns.add('del_yn',
    { nullable: false, dataType: 'char(1)', defaultValue: 'N' }
);

export default ctxMember;
export { ctxMember };
