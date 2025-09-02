export function transformSqlNames(sql, opts = {}) {
  const {
    // 이름 치환 맵
    tableMap = {}, // { original: mapped }
    // columnMap: { table: { col: mapped }, ... } 또는 { col: mapped }
    columnMap = {},
    // 접두/접미사
    tablePrefix = '',
    tableSuffix = '',
    columnPrefix = '',
    columnSuffix = '',
    // 예외 처리 및 대소문자
    excludeTables = [], // Array<string|RegExp>
    excludeColumns = [], // Array<string|RegExp>
    caseSensitive = false, // 일반 SQL은 식별자 대소문자 무시가 많음
  } = opts;

  // ===== Helpers =====
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const norm = (s) => (caseSensitive ? s : s.toLowerCase());
  const hasAffix = (name, pre, suf) => (
    (pre ? name.startsWith(pre) : true) && (suf ? name.endsWith(suf) : true)
  );
  const addAffix = (name, pre, suf) => {
    const hasPre = pre && name.startsWith(pre);
    const hasSuf = suf && name.endsWith(suf);
    return `${hasPre ? '' : pre}${name}${hasSuf ? '' : suf}`;
  };
  const stripAffix = (name, pre, suf) => {
    let out = name;
    if (pre && out.startsWith(pre)) out = out.slice(pre.length);
    if (suf && out.endsWith(suf)) out = out.slice(0, out.length - suf.length);
    return out;
  };
  const matchList = (name, list) => list.some((p) =>
    typeof p === 'string'
      ? norm(name) === norm(p)
      : p instanceof RegExp
        ? p.test(name)
        : false
  );
  const isIdent = (s) => /[A-Za-z_][A-Za-z0-9_]*/.test(s);
  const isKeyword = (w) => {
    const k = w.toUpperCase();
    return keywords.has(k);
  };
  const keywords = new Set([
    'SELECT','FROM','WHERE','AND','OR','AS','MAX','MIN','COUNT','ON','JOIN','LEFT','RIGHT','INNER','OUTER','FULL','GROUP','BY','ORDER','INSERT','INTO','VALUES','UPDATE','SET','DELETE','CREATE','TABLE','ALTER','DROP','TRUNCATE','HAVING','DISTINCT','UNION','ALL','CASE','WHEN','THEN','ELSE','END','LIMIT','OFFSET'
  ]);

  // columnMap 평탄화/준비
  const isPerTableColMap = Object.values(columnMap).some((v) => v && typeof v === 'object');
  const perTableColMap = isPerTableColMap ? columnMap : {};
  const globalColMap = isPerTableColMap ? {} : columnMap; // { col: mapped }

  // 역 테이블맵 (매핑된 이름 -> 원본)
  const revTableMap = Object.fromEntries(
    Object.entries(tableMap).map(([orig, mapped]) => [norm(mapped), orig])
  );
  const mappedTableValues = new Set(Object.values(tableMap).map(norm));

  // 유일 전역 컬럼 매핑 후보 계산: perTable에서 동일 원본컬럼이 하나의 매핑으로만 등장할 때 허용
  const uniqueColMap = (() => {
    if (Object.keys(globalColMap).length) return globalColMap;
    const count = new Map(); // orig -> Set(mapped)
    for (const m of Object.values(perTableColMap)) {
      for (const [c, v] of Object.entries(m)) {
        if (!count.has(c)) count.set(c, new Set());
        count.get(c).add(v);
      }
    }
    const out = {};
    for (const [c, set] of count.entries()) if (set.size === 1) out[c] = [...set][0];
    return out;
  })();

  // ===== 1) 문자열/주석 분리 =====
  const segments = splitSqlSegments(sql);

  // 가변 처리함수: 코드 세그먼트만 치환
  const process = (text) => {
    let s = text;

    // --- A) 테이블/컬럼 매핑 (접두/접미사 미적용) ---
    // A1. 테이블 매핑
    if (Object.keys(tableMap).length) {
      const keys = Object.keys(tableMap).sort((a,b)=>b.length-a.length).map(esc).join('|');
      const re = new RegExp(`\\b(?:${keys})\\b`, caseSensitive ? 'g' : 'gi');
      s = s.replace(re, (m) => tableMap[caseSensitive ? m : findKeyIgnoreCase(tableMap, m)]);
    }

    // A2. 컬럼 매핑 - (i) table.column 형태 우선
    s = s.replace(/\b([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\b/g, (full, left, right) => {
      // left: 스키마/테이블/별칭 등. 가능한 원본 테이블명 추정
      let tCandidate = left;
      const leftNorm = norm(left);
      if (revTableMap[leftNorm]) {
        tCandidate = revTableMap[leftNorm]; // 매핑된 테이블 -> 원본 복원
      } else {
        tCandidate = stripAffix(left, tablePrefix, tableSuffix);
      }

      let outRight = right;
      const tblMap = perTableColMap[tCandidate];
      if (tblMap && tblMap[right]) {
        outRight = tblMap[right];
      } else if (globalColMap[right]) {
        outRight = globalColMap[right];
      }
      return `${left}.${outRight}`;
    });

    // A3. 컬럼 매핑 - (ii) 단독 컬럼 (고유/전역 매핑만)
    if (Object.keys(uniqueColMap).length) {
      const keys = Object.keys(uniqueColMap).sort((a,b)=>b.length-a.length).map(esc).join('|');
      const re = new RegExp(`\\b(?:${keys})\\b`, caseSensitive ? 'g' : 'gi');
      s = s.replace(re, (m, offset) => {
        // 점(.)으로 수식된 경우는 위에서 처리됨 -> 건너뜀
        const prev = s[offset - 1];
        const next = s[offset + m.length];
        if (prev === '.' || next === '.') return m;
        const key = caseSensitive ? m : findKeyIgnoreCase(uniqueColMap, m);
        return uniqueColMap[key];
      });
    }

    // --- B) 테이블 접두/접미사 적용 (매핑 결과/제외대상/이미 접두/접미사 적용된 경우 제외) ---
    // B1. 키워드 뒤 테이블명 (FROM/JOIN/INTO/UPDATE)
    s = s.replace(/\b(FROM|JOIN|INTO|UPDATE)\b\s+((?:[A-Za-z_][A-Za-z0-9_]*\.)?[A-Za-z_][A-Za-z0-9_]*)/gi,
      (full, kw, name) => {
        const parts = name.split('.');
        const tbl = parts.pop();
        const schema = parts.length ? parts.join('.') + '.' : '';
        const original = stripAffix(tbl, tablePrefix, tableSuffix);
        if (mappedTableValues.has(norm(tbl)) || matchList(tbl, excludeTables)) return `${kw} ${schema}${tbl}`;
        const affixed = addAffix(original, tablePrefix, tableSuffix);
        return `${kw} ${schema}${affixed}`;
      });

    // B2. DDL 계열 (CREATE/ALTER/DROP/TRUNCATE TABLE)
    s = s.replace(/\b(CREATE|ALTER|DROP|TRUNCATE)\s+TABLE\b\s+((?:[A-Za-z_][A-Za-z0-9_]*\.)?[A-Za-z_][A-Za-z0-9_]*)/gi,
      (full, kw, name) => {
        const parts = name.split('.');
        const tbl = parts.pop();
        const schema = parts.length ? parts.join('.') + '.' : '';
        const original = stripAffix(tbl, tablePrefix, tableSuffix);
        if (mappedTableValues.has(norm(tbl)) || matchList(tbl, excludeTables)) return `${kw} TABLE ${schema}${tbl}`;
        const affixed = addAffix(original, tablePrefix, tableSuffix);
        return `${kw} TABLE ${schema}${affixed}`;
      });

    // B3. 점 앞(좌) 토큰이 테이블로 쓰이는 경우: TableA.col -> TableAffixed.col
    s = s.replace(/\b([A-Za-z_][A-Za-z0-9_]*)\b(?=\.)/g, (m) => {
      const tbl = m;
      const original = stripAffix(tbl, tablePrefix, tableSuffix);
      if (mappedTableValues.has(norm(tbl)) || matchList(tbl, excludeTables)) return tbl;
      if (!isIdent(tbl) || isKeyword(tbl)) return tbl;
      return addAffix(original, tablePrefix, tableSuffix);
    });

    // --- C) 컬럼 접두/접미사 적용 ---
    // C1. table.column 형태의 컬럼
    s = s.replace(/\b([A-Za-z_][A-Za-z0-9_]*)\.([A-Za-z_][A-Za-z0-9_]*)\b/g, (full, left, right) => {
      // 매핑된 컬럼은 그대로 두고, 아니라면 접두/접미사
      const isMappedCol = !!(
        (perTableColMap[stripAffix(left, tablePrefix, tableSuffix)] && perTableColMap[stripAffix(left, tablePrefix, tableSuffix)][right]) ||
        globalColMap[right]
      );
      if (isMappedCol || matchList(right, excludeColumns)) return `${left}.${right}`;
      return `${left}.${addAffix(stripAffix(right, columnPrefix, columnSuffix), columnPrefix, columnSuffix)}`;
    });

    // 테이블 토큰 위치 수집: FROM/JOIN/INTO/UPDATE, DDL의 TABLE 다음 식별자
    const tableTokenPositions = [];
    const capLastSegment = (baseIndex, matchedWhole, namePart) => {
      // namePart can be schema.table or table
      const relStartInWhole = matchedWhole.indexOf(namePart);
      let start = baseIndex + relStartInWhole;
      let last = namePart;
      const dot = namePart.lastIndexOf('.');
      if (dot !== -1) {
        start += dot + 1;
        last = namePart.slice(dot + 1);
      }
      const end = start + last.length;
      tableTokenPositions.push({ start, end });
    };
    let m1;
    const reFromJoin = /\b(FROM|JOIN|INTO|UPDATE)\b\s+((?:[A-Za-z_][A-Za-z0-9_]*\.)?[A-Za-z_][A-Za-z0-9_]*)/gi;
    while ((m1 = reFromJoin.exec(s)) !== null) capLastSegment(m1.index, m1[0], m1[2]);
    let m2;
    const reDDL = /\b(CREATE|ALTER|DROP|TRUNCATE)\s+TABLE\b\s+((?:[A-Za-z_][A-Za-z0-9_]*\.)?[A-Za-z_][A-Za-z0-9_]*)/gi;
    while ((m2 = reDDL.exec(s)) !== null) capLastSegment(m2.index, m2[0], m2[2]);

    // C2. 단독 컬럼 토큰 (키워드/함수/테이블 위치/매핑/제외는 건너뜀)
    s = replaceIdentifiers(s, (token, offset, str) => {
      if (isKeyword(token)) return token;
      const prev = str[offset - 1] || '';
      const next = str[offset + token.length] || '';
      // 함수명/점(.) 접합/숫자/파라미터 등 회피
      if (prev === '.' || next === '.' || next === '(') return token;
      // 테이블 토큰 위치(이미 affix 적용됨)에서는 컬럼 affix 금지
      if (tableTokenPositions.some(({ start, end }) => offset >= start && offset < end)) return token;
      if (matchList(token, excludeColumns)) return token;
      // 이미 매핑된 컬럼명이라면 그대로 둠
      const isMapped = findInValueMap(uniqueColMap, token, caseSensitive) || findInValueNested(perTableColMap, token, caseSensitive);
      if (isMapped) return token;
      return addAffix(stripAffix(token, columnPrefix, columnSuffix), columnPrefix, columnSuffix);
    });

    return s;
  };

  return segments.map(seg => seg.type === 'code' ? process(seg.text) : seg.text).join('');
}

// ===== Utilities =====
function findKeyIgnoreCase(map, key) {
  const k = Object.keys(map).find((x) => x.toLowerCase() === key.toLowerCase());
  return k ?? key;
}

function findInValueMap(map, val, caseSensitive) {
  const n = caseSensitive ? val : val.toLowerCase();
  for (const v of Object.values(map)) {
    if ((caseSensitive ? v : v.toLowerCase()) === n) return true;
  }
  return false;
}

function findInValueNested(nested, val, caseSensitive) {
  const n = caseSensitive ? val : val.toLowerCase();
  for (const m of Object.values(nested)) {
    for (const v of Object.values(m)) {
      if ((caseSensitive ? v : v.toLowerCase()) === n) return true;
    }
  }
  return false;
}

function replaceIdentifiers(str, replacer) {
  const re = /\b([A-Za-z_][A-Za-z0-9_]*)\b/g;
  return str.replace(re, (m, _g1, offset) => replacer(m, offset, str));
}

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

    // 라인 주석 -- ...\n
    if (ch === '-' && next === '-') {
      pushCode(i);
      const j = sql.indexOf('\n', i + 2);
      i = j === -1 ? len : j + 1;
      pushSkip(i);
      continue;
    }
    // 블록 주석 /* ... */
    if (ch === '/' && next === '*') {
      pushCode(i);
      const j = sql.indexOf('*/', i + 2);
      i = j === -1 ? len : j + 2;
      pushSkip(i);
      continue;
    }
    // 대괄호 식별자 [ ... ]
    if (ch === '[') {
      pushCode(i);
      const j = sql.indexOf(']', i + 1);
      i = j === -1 ? len : j + 1;
      pushSkip(i);
      continue;
    }
    // 백틱 `...`
    if (ch === '`') {
      pushCode(i);
      let j = i + 1;
      while (j < len) {
        if (sql[j] === '`') { j++; break; }
        j++;
      }
      i = j;
      pushSkip(i);
      continue;
    }
    // 작은따옴표 '...'
    if (ch === '\'') {
      pushCode(i);
      let j = i + 1;
      while (j < len) {
        if (sql[j] === '\'' && sql[j + 1] === '\'') { j += 2; continue; } // '' 이스케이프
        if (sql[j] === '\'') { j++; break; }
        j++;
      }
      i = j;
      pushSkip(i);
      continue;
    }
    // 큰따옴표 "..."
    if (ch === '"') {
      pushCode(i);
      let j = i + 1;
      while (j < len) {
        if (sql[j] === '"' && sql[j + 1] === '"') { j += 2; continue; } // "" 이스케이프
        if (sql[j] === '"') { j++; break; }
        j++;
      }
      i = j;
      pushSkip(i);
      continue;
    }

    i++;
  }
  // 남은 코드
  pushCode(len);
  return out;
}
