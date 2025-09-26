import { SQLContext } from '../../../src/sql-context.js';
import { ctx_sto_account } from '../sto-addon-account/index.js';
import { ctx_meb_account } from '../meb-addon-account/index.js';

const ctx_v1 = new SQLContext('ctx_v1');

ctx_v1.contexts.add(ctx_sto_account);
ctx_v1.contexts.add(ctx_meb_account);

export default ctx_v1;
export { ctx_v1 };
