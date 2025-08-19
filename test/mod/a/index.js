import { SQLSet } from '../../../src/sql-set.js';

const provide = 'common';


const mod_a = new SQLSet('person');

console.log('provide', provide);


export { mod_a };