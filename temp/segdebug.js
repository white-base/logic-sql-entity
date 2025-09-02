function splitSqlSegments(sql) {
  const out = [];
  let i = 0;
  let last = 0;
  const len = sql.length;
  const pushCode = (end) => { if (end > last) out.push({ type: 'code', text: sql.slice(last, end) }); last = end; };
  const pushSkip = (end) => { out.push({ type: 'skip', text: sql.slice(last, end) }); last = end; };

  while (i < len) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (ch === '-' && next === '-') {
      pushCode(i);
      const j = sql.indexOf('\n', i + 2);
      i = j === -1 ? len : j + 1;
      pushSkip(i);
      continue;
    }
    if (ch === '/' && next === '*') {
      pushCode(i);
      const j = sql.indexOf('*/', i + 2);
      i = j === -1 ? len : j + 2;
      pushSkip(i);
      continue;
    }
    if (ch === '\'') {
      pushCode(i);
      let j = i + 1;
      while (j < len) {
        if (sql[j] === '\'' && sql[j + 1] === '\'') { j += 2; continue; }
        if (sql[j] === '\'') { j++; break; }
        j++;
      }
      i = j;
      pushSkip(i);
      continue;
    }
    i++;
  }
  pushCode(len);
  return out;
}

const q = `
  SELECT MAX("prt_id") AS "max_prt_id"
  FROM "prt_master";
`;
const segs = splitSqlSegments(q);
console.log(segs);
