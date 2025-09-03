/**
 * 인덱스 이름 생성기
 * @param {string} tableName  테이블명
 * @param {string} groupKey   인덱스 그룹 키
 * @param {string[]} cols     컬럼 배열
 */
const makeIndexName = (tableName, groupKey, cols) =>
  `idx_${tableName}_${groupKey}_${cols.join('_')}`;

/**
 * 컬럼 메타에서 인덱스 그룹 수집
 * @param {string} tableName   테이블 이름
 * @param {Object} columns     { colName: { type, indexes }, ... }
 * @returns {Array}            [{ name, group, columns }]
 */
export function collectIndexGroups(tableName, columns) {
  const groups = new Map();

  for (const [colName, meta] of Object.entries(columns)) {
    const idxs = meta.indexes;
    if (!idxs) continue;

    // 단일 값도 배열처럼 처리
    const arr = Array.isArray(idxs) ? idxs : [idxs];

    // 같은 컬럼 내 중복 제거
    for (const rawKey of new Set(arr)) {
      if (rawKey === null || rawKey === undefined) continue;
      const groupKey = String(rawKey).trim();
      if (!groupKey) continue;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      const cols = groups.get(groupKey);
      if (!cols.includes(colName)) cols.push(colName);
    }
  }

  const out = [];
  for (const [groupKey, cols] of groups.entries()) {
    out.push({
      name: makeIndexName(tableName, groupKey, cols),
      group: groupKey,
      columns: cols
    });
  }
  return out;
}

// /* ============================
//  * 사용 예
//  * ============================ */
// const columns = {
//   aa: { type: 'varchar', indexes: [1, 2] },
//   bb: { type: 'int',     indexes: [1] },
//   cc: { type: 'date',    indexes: ['arch'] },
//   dd: { type: 'int' } // indexes 없음
// };

// const indexDefs = collectIndexGroups('ABC', columns);
// console.log(indexDefs);

// /* 출력:
// [
//   { name: 'idx_ABC_1_aa_bb',   group: '1',    columns: [ 'aa', 'bb' ] },
//   { name: 'idx_ABC_2_aa',      group: '2',    columns: [ 'aa' ] },
//   { name: 'idx_ABC_arch_cc',   group: 'arch', columns: [ 'cc' ] }
// ]
// */