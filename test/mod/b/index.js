import { SQLSet } from '../../../src/sql-set.js';
import { mod_a } from '../a/index.js';

const provide = 'system';

const mod_b = new SQLSet('person');

console.log('provide', provide);

export { mod_a, mod_b };