import ctx_sto_core from './sto-core.index.js';

import { SqliteDialect } from 'kysely'
import Database from 'better-sqlite3'

ctx_sto_core.connect = {
    dialect: new SqliteDialect({
        database: new Database(':memory:')
    })
};

ctx_sto_core.createSchema();

console.log(ctx_sto_core);

console.log('.');


// expo