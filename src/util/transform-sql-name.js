export function transformSqlNames(sql, opts = {}) {
    // DEBUG marker
    // console.log('DBG transformSqlNames called')
    const {
    // 이름 치환 맵
        tableMap = {}, // { original: mapped }
        // 접두/접미사
        tablePrefix = '',
        tableSuffix = '',
        // 예외 처리 및 대소문자
        excludeTables = [], // Array<string|RegExp>
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

    // 역 테이블맵 (매핑된 이름 -> 원본)
    const revTableMap = Object.fromEntries(
        Object.entries(tableMap).map(([orig, mapped]) => [norm(mapped), orig])
    );
    const mappedTableValues = new Set(Object.values(tableMap).map(norm));


    // ===== 1) 문자열/주석 분리 =====
    const segments = splitSqlSegments(sql);

    // 가변 처리함수: 코드 세그먼트만 치환
    const process = (text) => {
        let s = text;

        // 토큰 유틸: 식별자 토큰(스키마 포함 가능)의 정규식과 헬퍼
        // 간단/안전한 인용 식별자 토큰 (백슬래시 이스케이프는 고려하지 않음)
        const identToken = '(?:"[^"]*"|`[^`]*`|\\[[^\\]]+\\]|[A-Za-z_][A-Za-z0-9_]*)';
        const unquote = (tok) => {
            if (!tok) return { name: '', quote: null };
            if (tok.startsWith('"') && tok.endsWith('"')) {
                // Postgres 식별자: "" -> " 로 이스케이프되지만 여기서는 단순 처리
                return { name: tok.slice(1, -1).replace(/""/g, '"'), quote: '"' };
            }
            if (tok.startsWith('`') && tok.endsWith('`')) {
                return { name: tok.slice(1, -1), quote: '`' };
            }
            if (tok.startsWith('[') && tok.endsWith(']')) {
                return { name: tok.slice(1, -1), quote: '[]' };
            }
            return { name: tok, quote: null };
        };
        const rewrap = (name, quote) => {
            if (quote === '"') return `"${name.replace(/"/g, '""')}"`;
            if (quote === '`') return `\`${name}\``;
            if (quote === '[]') return `[${name}]`;
            return name;
        };

        // --- A) 테이블 매핑 (접두/접미사 미적용) ---
        // A1. 테이블 매핑
        if (Object.keys(tableMap).length) {
            const keys = Object.keys(tableMap).sort((a,b)=>b.length-a.length).map(esc).join('|');
            const re = new RegExp(`\\b(?:${keys})\\b`, caseSensitive ? 'g' : 'gi');
            s = s.replace(re, (m) => tableMap[caseSensitive ? m : findKeyIgnoreCase(tableMap, m)]);
        }

        // --- B) 테이블 접두/접미사 적용 + (문맥 내) 매핑 처리 ---
        //      - 문맥상 테이블로 확실한 토큰에 대해서는 쌍따옴표 등 인용 포함 처리를 하고,
        //        tableMap이 매칭되면 접두/접미사는 적용하지 않는다.
        // B1. 키워드 뒤 테이블명 (FROM/JOIN/INTO/UPDATE) - 인용식별자 지원
        {
            const reFromJoin = new RegExp(`\\b(FROM|JOIN|INTO|UPDATE)\\b\\s+((?:${identToken}\\.)?)(${identToken})`, 'gi');
            s = s.replace(reFromJoin, (full, kw, schemaDot, tblTok) => {
                // DEBUG: mark match
                if (process && process.env && process.env.DEBUG_SQL_TRANSFORM) {
                    console.log('DBG FROM/JOIN match', { full, kw, schemaDot, tblTok });
                }
                const { name: tblName, quote } = unquote(tblTok);
                const original = stripAffix(tblName, tablePrefix, tableSuffix);
                // 매핑 우선 (대소문자 옵션 반영)
                const mapped = caseSensitive
                    ? tableMap[original]
                    : tableMap[findKeyIgnoreCase(tableMap, original)];
                if (mapped) {
                    const outTok = rewrap(mapped, quote);
                    return `${kw} ${schemaDot || ''}${outTok}`;
                }
                if (mappedTableValues.has(norm(tblName)) || matchList(tblName, excludeTables)) {
                    return `${kw} ${schemaDot || ''}${tblTok}`;
                }
                const affixed = addAffix(original, tablePrefix, tableSuffix);
                const outTok = rewrap(affixed, quote);
                return `${kw} ${schemaDot || ''}${outTok}`;
            });
        }

        // B2. DDL 계열 (CREATE/ALTER/DROP/TRUNCATE TABLE) - 인용식별자 지원
        {
            const reDDL = new RegExp(`\\b(CREATE|ALTER|DROP|TRUNCATE)\\s+TABLE\\b\\s+((?:${identToken}\\.)?)(${identToken})`, 'gi');
            s = s.replace(reDDL, (full, kw, schemaDot, tblTok) => {
                const { name: tblName, quote } = unquote(tblTok);
                const original = stripAffix(tblName, tablePrefix, tableSuffix);
                // 매핑 우선 (대소문자 옵션 반영)
                const mapped = caseSensitive
                    ? tableMap[original]
                    : tableMap[findKeyIgnoreCase(tableMap, original)];
                if (mapped) {
                    const outTok = rewrap(mapped, quote);
                    return `${kw} TABLE ${schemaDot || ''}${outTok}`;
                }
                if (mappedTableValues.has(norm(tblName)) || matchList(tblName, excludeTables)) {
                    return `${kw} TABLE ${schemaDot || ''}${tblTok}`;
                }
                const affixed = addAffix(original, tablePrefix, tableSuffix);
                const outTok = rewrap(affixed, quote);
                return `${kw} TABLE ${schemaDot || ''}${outTok}`;
            });
        }

        // B3. 점 앞(좌) 토큰이 테이블로 쓰이는 경우: TableA.col / "TableA".col
        {
            // 앞 문자가 식별자 구성요소가 아닌 경우에만 매칭 시작
            const reLeftOfDot = new RegExp('(^|[^A-Za-z0-9_"`\\]])(' + identToken + ')(?=\\.)', 'g');
            s = s.replace(reLeftOfDot, (full, pre, tok) => {
                const { name: tbl, quote } = unquote(tok);
                const original = stripAffix(tbl, tablePrefix, tableSuffix);
                // 매핑 우선 (대소문자 옵션 반영)
                const mapped = caseSensitive
                    ? tableMap[original]
                    : tableMap[findKeyIgnoreCase(tableMap, original)];
                if (mapped) return pre + rewrap(mapped, quote);
                if (mappedTableValues.has(norm(tbl)) || matchList(tbl, excludeTables)) return pre + tok;
                if (!isIdent(tbl) || isKeyword(tbl)) return pre + tok;
                const affixed = addAffix(original, tablePrefix, tableSuffix);
                return pre + rewrap(affixed, quote);
            });
        }


        // 컬럼 관련 기능은 제거됨

        return s;
    };

    if (process && process.env && process.env.DEBUG_SQL_TRANSFORM) {
        console.log('DBG segments count', segments.length);
        segments.forEach((seg, i) => console.log('DBG seg', i, seg.type, JSON.stringify(seg.text)));
    }
    return segments.map(seg => seg.type === 'code' ? process(seg.text) : seg.text).join('');
}

// ===== Utilities =====
function findKeyIgnoreCase(map, key) {
    const k = Object.keys(map).find((x) => x.toLowerCase() === key.toLowerCase());
    return k ?? key;
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
        // 식별자 인용자(대괄호/백틱/큰따옴표)는 코드로 유지하여 처리 대상에 포함
        // - 문자열 리터럴('...')과 주석만 skip 처리
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
        // 큰따옴표는 Postgres 등에서 식별자 인용으로 쓰이므로 skip하지 않음

        i++;
    }
    // 남은 코드
    pushCode(len);
    return out;
}
