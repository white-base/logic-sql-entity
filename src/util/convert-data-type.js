// -------------------------------------------------------------
// 1) 공통: 타입 문자열 파서 (정규표현식)
//    - 대소문자 무시, 공백/따옴표/키워드 변형 허용
//    - varchar(255), numeric(18,2) 같은 인자 파싱
// -------------------------------------------------------------
const TYPE_RE = /^\s*([a-zA-Z_ ]+)\s*(?:\(\s*([0-9]+)\s*(?:,\s*([0-9]+)\s*)?\))?\s*$/;

function parseType(typeStr) {
    if (typeof typeStr !== 'string') return { base: '', args: [] };
    const s = typeStr.trim().replace(/\s+/g, ' ').toLowerCase();
    const m = s.match(TYPE_RE);
    if (!m) return { base: s, args: [] };
    const base = m[1].trim();             // 예: 'varchar', 'double precision', 'uniqueidentifier'
    const a1 = m[2] ? Number(m[2]) : undefined;
    const a2 = m[3] ? Number(m[3]) : undefined;
    const args = [];
    if (Number.isFinite(a1)) args.push(a1);
    if (Number.isFinite(a2)) args.push(a2);
    return { base, args };
}

function fmtArgs(args, fallback = '') {
    if (!args || !args.length) return fallback;
    if (args.length === 1) return `(${args[0]})`;
    return `(${args[0]}, ${args[1]})`;
}

// -------------------------------------------------------------
// 2) 표준 → 벤더 매핑
//    - 필요 시 기본값 보정(varchar 길이, numeric(precision,scale) 등)
// -------------------------------------------------------------
function convertStandardToVendor(stdType, vendor) {
    const { base, args } = parseType(stdType);
    const v = (vendor || '').toLowerCase();

    // 표준 기본값 보정
    const type = base.replace(/\s+/g, ' ');
    const L = (def) => fmtArgs(args, def);

    const map = {
        sqlite() {
            switch (type) {
            case 'int':            return 'INTEGER';
            case 'bigint':         return 'INTEGER'; // 64-bit 정수 저장 가능
            case 'numeric':        return 'NUMERIC';
            case 'double':         return 'REAL';
            case 'boolean':        return 'INTEGER'; // 0/1
            case 'varchar':        return 'TEXT';    // 길이는 메타로 관리
            case 'text':           return 'TEXT';
            case 'char':           return 'TEXT';    // CHAR(n) 의미 보장 어려움 → CHECK로 보완 권장
            case 'date':           return 'NUMERIC'; // 또는 TEXT
            case 'time':           return 'NUMERIC'; // 또는 TEXT
            case 'timestamp':      return 'NUMERIC'; // 또는 TEXT (UTC 저장 권장)
            case 'json':           return 'TEXT';    // JSON1 확장 사용 시 함수 제공
            case 'uuid':           return 'TEXT';    // 함수/확장으로 생성 가능
            case 'bytes':          return 'BLOB';
            default:               return 'TEXT';
            }
        },
        mysql() {
            switch (type) {
            case 'int':            return 'INTEGER';
            case 'bigint':         return 'BIGINT';
            case 'numeric':        return 'NUMERIC' + L('(18, 0)');   // 기본 정밀도 보정
            case 'double':         return 'DOUBLE PRECISION';
            case 'boolean':        return 'SMALLINT'; // TINYINT(1) 대신
            case 'varchar':        return 'VARCHAR' + L('(255)');
            case 'text':           return 'TEXT';
            case 'char':           return 'CHAR' + L('(10)');
            case 'date':           return 'DATE';
            case 'time':           return 'TIME' + L('');
            case 'timestamp':      return 'DATETIME' + L('');         // fractional precision은 args로
            case 'json':           return 'JSON';
            case 'uuid':           return 'CHAR(36)';                 // 또는 BINARY(16) 전략
            case 'bytes':          return 'VARBINARY' + L('(255)');   // 큰 용량 필요 시 LONGBLOB로 승격은 스키마 옵션으로
            default:               return 'LONGTEXT';
            }
        },
        mariadb() { // 추가
            // MariaDB는 MySQL과 거의 동일
            return map.mysql();
        },
        postgres() {
            switch (type) {
            case 'int':            return 'INTEGER';
            case 'bigint':         return 'BIGINT';
            case 'numeric':        return 'NUMERIC' + L('');
            case 'double':         return 'DOUBLE PRECISION';
            case 'boolean':        return 'BOOLEAN';
            case 'varchar':        return 'VARCHAR' + L('(255)');
            case 'text':           return 'TEXT';
            case 'char':           return 'CHAR' + L('(10)');
            case 'date':           return 'DATE';
            case 'time':           return 'TIME' + L('');
            case 'timestamp':      return 'TIMESTAMP' + L('');
            case 'json':           return 'JSONB';   // 공통(json) → PG에선 JSONB 채택
            case 'uuid':           return 'UUID';
            case 'bytes':          return 'BYTEA';
            default:               return 'TEXT';
            }
        },
        mssql() {
            switch (type) {
            case 'int':            return 'INTEGER';
            case 'bigint':         return 'BIGINT';
            case 'numeric':        return 'NUMERIC' + (args.length ? L('') : '(18, 0)');
            case 'double':         return 'DOUBLE PRECISION'; // FLOAT(53) ≈ double
            case 'boolean':        return 'SMALLINT'; // TINYINT(1) 없음
            case 'varchar':        return 'VARCHAR' + L('(255)');
            case 'text':           return 'VARCHAR(8000)'; // NTEXT는 deprecated
            case 'char':           return 'CHAR' + L('(10)');
            case 'date':           return 'DATE';
            case 'time':           return 'TIME' + L('');
            case 'timestamp':      return 'DATETIME';
            case 'json':           return 'VARCHAR(8000)'; // + CHECK(ISJSON(col)=1) 권장
            case 'uuid':           return 'VARCHAR(36)';
            case 'bytes':          return 'VARBINARY(8000)';
            default:               return 'VARCHAR(8000)';
            }
        },

    };

    if (map[v]) return map[v]();
    return (base || 'text').toUpperCase() + (args.length ? fmtArgs(args) : '');
}

// -------------------------------------------------------------
// 3) 벤더 → 표준 매핑
//    - 벤더 타입을 정규표현식으로 식별해 표준 타입명으로 환원
//    - 길이/정밀도 인자는 가능하면 보존
// -------------------------------------------------------------
function convertVendorToStandard(vendorType, vendor) {
    const { base, args } = parseType(vendorType);
    const b = base.replace(/\s+/g, ' ');
    const v = (vendor || '').toLowerCase();

    // 표준 타입 포매터
    const out = {
        bare: (t) => t,
        len:  (t, n) => `${t}(${n})`,
        ps:   (t, p, s) => `${t}(${p}${typeof s === 'number' ? ','+s : ''})`,
    };

    const m = {
        mysql() {
            if (/^tinyint(1)$/.test(b)) return 'boolean';
            if (/^int$/.test(b)) return 'int';
            if (/^bigint$/.test(b)) return 'bigint';
            if (/^decimal$/.test(b) || /^numeric$/.test(b)) return out.ps('numeric', args[0] ?? 18, args[1] ?? 0);
            if (/^double$/.test(b)) return 'double';
            if (/^float$/.test(b)) return 'real';
            if (/^varchar$/.test(b)) return out.len('varchar', args[0] ?? 255);
            if (/^(text|mediumtext|longtext|tinytext)$/.test(b)) return 'text';
            if (/^date$/.test(b)) return 'date';
            if (/^time$/.test(b)) return 'time';
            if (/^datetime$/.test(b)) return 'timestamp';
            if (/^timestamp$/.test(b)) return 'timestamp';
            if (/^binary$/.test(b)) return out.len('binary', args[0] ?? 16);
            if (/^varbinary$/.test(b)) return out.len('varbinary', args[0] ?? 255);
            if (/^(blob|mediumblob|longblob|tinyblob)$/.test(b)) return 'blob';
            if (/^json$/.test(b)) return 'json';
            if (/^char$/.test(b) && args[0] === 36) return 'uuid';
            return 'text';
        },
        mariadb() { // 추가
            // MariaDB는 MySQL과 거의 동일
            return m.mysql();
        },
        postgres() {
            if (/^integer$/.test(b) || /^int4$/.test(b)) return 'int';
            if (/^bigint$/.test(b) || /^int8$/.test(b)) return 'bigint';
            if (/^numeric$/.test(b)) return out.ps('numeric', args[0] ?? 18, args[1] ?? 0);
            if (/^real$/.test(b)) return 'real';
            if (/^double precision$/.test(b)) return 'double';
            if (/^boolean$/.test(b)) return 'boolean';
            if (/^varchar$/.test(b) || /^character varying$/.test(b)) return out.len('varchar', args[0] ?? 255);
            if (/^text$/.test(b)) return 'text';
            if (/^date$/.test(b)) return 'date';
            if (/^time$/.test(b)) return 'time';
            if (/^timestamp$/.test(b)) return 'timestamp';
            if (/^timestamptz$/.test(b) || /^timestamp with time zone$/.test(b)) return 'timestamptz';
            if (/^bytea$/.test(b)) return 'blob';
            if (/^jsonb?$/.test(b)) return 'json';
            if (/^uuid$/.test(b)) return 'uuid';
            return 'text';
        },
        mssql() {
            if (/^bit$/.test(b)) return 'boolean';
            if (/^int$/.test(b)) return 'int';
            if (/^bigint$/.test(b)) return 'bigint';
            if (/^decimal$/.test(b) || /^numeric$/.test(b)) return out.ps('numeric', args[0] ?? 18, args[1] ?? 0);
            if (/^real$/.test(b)) return 'real';
            if (/^float$/.test(b)) return 'double'; // FLOAT(53) ≈ double
            if (/^varchar$/.test(b)) return out.len('varchar', args[0] ?? 255);
            if (/^varchar\(max\)$/.test(b)) return 'text';
            if (/^date$/.test(b)) return 'date';
            if (/^time$/.test(b)) return 'time';
            if (/^datetime2$/.test(b)) return 'timestamp';
            if (/^datetimeoffset$/.test(b)) return 'timestamptz';
            if (/^binary$/.test(b)) return out.len('binary', args[0] ?? 16);
            if (/^varbinary$/.test(b)) return out.len('varbinary', args[0] ?? 255);
            if (/^varbinary\(max\)$/.test(b)) return 'blob';
            if (/^nvarchar\(max\)$/.test(b)) return 'text';
            if (/^uniqueidentifier$/.test(b)) return 'uuid';
            return 'text';
        },
        sqlite() {
            // 질문 예시: conver표준자료형('REAL','sqlite') => 'double'
            if (/^real$/.test(b)) return 'double';  // 요구사항에 맞춰 REAL→double
            if (/^integer$/.test(b)) return 'int';
            if (/^numeric$/.test(b)) return out.ps('numeric', args[0] ?? 18, args[1] ?? 0);
            if (/^text$/.test(b)) return 'text';
            if (/^blob$/.test(b)) return 'blob';
            // 날짜/시간/JSON/UUID는 TEXT/NUMERIC/BLOB로 저장되지만 표준 환원값을 보수적으로 지정
            return 'text';
        },
        oracle() {
            if (/^number$/.test(b)) {
                const p = args[0], s = args[1];
                if (typeof p === 'number' && typeof s === 'number') return out.ps('numeric', p, s);
                if (p === 1 && (s === undefined || s === 0)) return 'boolean';
                if (p >= 1 && p <= 10) return 'int';
                if (p > 10) return 'bigint';
                return 'numeric(18,0)';
            }
            if (/^binary_float$/.test(b))  return 'real';
            if (/^binary_double$/.test(b)) return 'double';
            if (/^varchar2$/.test(b))      return out.len('varchar', args[0] ?? 255);
            if (/^clob$/.test(b))          return 'text';
            if (/^date$/.test(b))          return 'timestamp'; // 시간 포함 → 보수적으로 timestamp로 환원
            if (/^timestamp$/.test(b))     return 'timestamp';
            if (/^timestamp with time zone$/.test(b)) return 'timestamptz';
            if (/^raw$/.test(b))           return args[0] === 16 ? 'uuid' : 'varbinary(' + (args[0] ?? 255) + ')';
            if (/^blob$/.test(b))          return 'blob';
            if (/^json$/.test(b))          return 'json';
            return 'text';
        }
    };

    if (m[v]) return m[v]();
    // 모르는 벤더면 보수적으로 표준 text
    return 'text';
}

// /**
//  * 표준 타입을 Kysely 컬럼 타입 문자열로 변환
//  * (테이블 스키마 정의 시 TypeScript 타입 힌트 용도)
//  * @param {string} stdType
//  * @returns {string}
//  */
// function convertStandardToKysely(stdType) {
//   const { base } = parseType(stdType);
//   const type = base.replace(/\s+/g, '');

//   switch (type) {
//     case 'int':
//     case 'bigint':
//     case 'numeric':
//     case 'real':
//     case 'double':
//       return 'number';
//     case 'boolean':
//       return 'boolean';
//     case 'varchar':
//     case 'text':
//     case 'date':
//     case 'time':
//     case 'timestamp':
//     case 'timestamptz':
//     case 'json':
//     case 'uuid':
//       return 'string';
//     case 'binary':
//     case 'varbinary':
//     case 'blob':
//       return 'Uint8Array';
//     default:
//       return 'unknown';
//   }
// }

/**
 * 표준 타입 여부 검사
 * @param {string} typeStr
 * @returns {boolean}
 */
function isStandardType(typeStr) {
    if (typeof typeStr !== 'string') return false;
    const { base } = parseType(typeStr);
    const stdTypes = [
        'int', 'bigint', 'numeric', 'double', 'boolean',
        'varchar', 'text', 'date', 'char', 'date', 'time', 'timestamp', 'json', 'uuid', 'bytes'
    ];
    return stdTypes.includes(base.replace(/\s+/g, ''));
}

export { convertStandardToVendor, convertVendorToStandard, isStandardType };
