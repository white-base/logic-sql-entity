import { SQLContext } from '../../../src/sql-context.js';
import { ctxStoAccount } from '../sto-addon-account/index.js';
import { ctxMebAccount } from '../meb-addon-account/index.js';

const ctx_v1 = new SQLContext('ctx_v1');

ctx_v1.contexts.add(ctxStoAccount);
ctx_v1.contexts.add(ctxMebAccount);

export default ctx_v1;
export { ctx_v1 };
