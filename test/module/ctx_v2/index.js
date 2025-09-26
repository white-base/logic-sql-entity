import { SQLContext } from '../../../src/sql-context.js';
import { ctx_sto_account } from '../sto-addon-account/index.js';
import { ctx_meb_account } from '../meb-addon-account/index.js';

const ctx_v2 = new SQLContext('ctx_v2');

ctx_v2.contexts.add(ctx_meb_account);
ctx_v2.contexts.add(ctx_sto_account);

export default ctx_v2;
export { ctx_v2 };
