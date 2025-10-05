import { SQLContext } from '../../../src/sql-context.js';
import { ctxStoAccount } from '../sto-addon-account/index.js';
import { ctxMebAccount } from '../meb-addon-account/index.js';

const ctx_v2 = new SQLContext('ctx_v2');

ctx_v2.contexts.add(ctxMebAccount);
ctx_v2.contexts.add(ctxStoAccount);

export default ctx_v2;
export { ctx_v2 };
