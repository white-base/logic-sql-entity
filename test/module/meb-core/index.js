import { SQLContext } from '../../../src/sql-context.js';
import { ctx_sto_core } from '../sto-core/index.js';

const ctx_meb_core = new SQLContext('meb_core');

ctx_meb_core.contexts.add(ctx_sto_core);
ctx_meb_core.tables.add('meb_master');

ctx_meb_core.tables['meb_master'].columns.add('meb_idx', 
    { primaryKey: true, autoIncrement: true, dataType: 'int' }
);
ctx_meb_core.tables['meb_master'].columns.add('sto_id', 
    { fk: 'sto_master.sto_id', dataType: 'varchar(10)', nullable: false }
);
ctx_meb_core.tables['meb_master'].columns.add('meb_name',
    { nullable: false, dataType: 'varchar(100)', nullable: false }
);
ctx_meb_core.tables['meb_master'].columns.add('status_cd',
    { nullable: false, dataType: 'char(2)', nullable: false }
);
ctx_meb_core.tables['meb_master'].columns.add('create_dt',
    { nullable: false, dataType: 'timestamp', defaultValue: { kind: 'now' } }
);
ctx_meb_core.tables['meb_master'].columns.add('update_dt',
    { nullable: false, dataType: 'timestamp' }
);
ctx_meb_core.tables['meb_master'].columns.add('del_yn',
    { nullable: false, dataType: 'char(1)', defaultValue: 'N' }
);

export default ctx_meb_core;
export { ctx_meb_core };
