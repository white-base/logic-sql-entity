import { convertStandardToVendor, convertVendorToStandard } from '../src/util/convert-data-type.js';

const aa  = convertStandardToVendor('int', 'mysql');       // 'INT'
console.log(aa);

const aa2 = convertStandardToVendor('varchar(2)', 'mysql'); // 'VARCHAR(2)'
console.log(aa2);

// 예제 2) 벤더 → 표준
const bb  = convertVendorToStandard('REAL', 'sqlite');     // 'double'
console.log(bb);

// 추가 예시
const cc  = convertStandardToVendor('numeric(10,2)', 'postgres'); // 'NUMERIC(10,2)'
console.log(cc);

const dd  = convertVendorToStandard('DOUBLE PRECISION', 'postgres'); // 'double'
console.log(dd);

const ee  = convertVendorToStandard('UNIQUEIDENTIFIER', 'mssql'); // 'uuid'
console.log(ee);

console.log('0');
