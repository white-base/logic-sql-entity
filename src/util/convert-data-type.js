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
  return `(${args[0]},${args[1]})`;
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
    mysql() {
      switch (type) {
        case 'int':         return 'INTEGER';              // ← 'int' 대신 'integer'
        case 'bigint':      return 'BIGINT';
        case 'numeric':     return `DECIMAL${L('(18,0)')}`;
        case 'real':        return 'REAL';                // MySQL REAL은 DOUBLE alias인 경우가 많으나 안전하게 FLOAT
        case 'double':      return 'REAL';
        case 'boolean':     return 'TINYINT(1)';
        case 'varchar':     return `VARCHAR${L('(255)')}`;
        case 'text':        return 'LONGTEXT';
        case 'date':        return 'DATE';
        case 'time':        return 'TIME';
        case 'timestamp':   return 'DATETIME';
        case 'timestamptz': return 'TIMESTAMP';            // 타임존 의미는 앱 레벨 처리
        case 'binary':      return `BINARY${L('(16)')}`;
        case 'varbinary':   return `VARBINARY${L('(255)')}`;
        case 'blob':        return 'LONGBLOB';
        case 'json':        return 'JSON';
        case 'uuid':        return 'CHAR(36)';            // 또는 BINARY(16)
        default:            return 'TEXT';
      }
    },
    mariadb() { // 추가
      // MariaDB는 MySQL과 거의 동일
      return map.mysql();
    },
    postgres() {
      switch (type) {
        case 'int':         return 'INTEGER';
        case 'bigint':      return 'BIGINT';
        case 'numeric':     return `NUMERIC${L('')}`;
        case 'real':        return 'REAL';
        case 'double':      return 'DOUBLE PRECISION';
        case 'boolean':     return 'BOOLEAN';
        case 'varchar':     return `VARCHAR${L('(255)')}`;
        case 'text':        return 'TEXT';
        case 'date':        return 'DATE';
        case 'time':        return 'TIME';
        case 'timestamp':   return 'TIMESTAMP';
        case 'timestamptz': return 'TIMESTAMPTZ';
        case 'binary':
        case 'varbinary':
        case 'blob':        return 'BYTEA';
        case 'json':        return 'JSONB';
        case 'uuid':        return 'UUID';
        default:            return 'TEXT';
      }
    },
    mssql() {
      switch (type) {
        case 'int':         return 'INT';
        case 'bigint':      return 'BIGINT';
        case 'numeric':     return `DECIMAL${L('') || '(18,0)'}`;
        case 'real':        return 'REAL';
        case 'double':      return 'FLOAT(53)';
        case 'boolean':     return 'BIT';
        case 'varchar':     return `VARCHAR${L('(255)')}`;
        case 'text':        return 'VARCHAR(MAX)';         // NTEXT deprecated
        case 'date':        return 'DATE';
        case 'time':        return 'TIME';
        case 'timestamp':   return 'DATETIME2';
        case 'timestamptz': return 'DATETIMEOFFSET';
        case 'binary':      return `BINARY${L('(16)')}`;
        case 'varbinary':   return `VARBINARY${L('(255)')}`;
        case 'blob':        return 'VARBINARY(MAX)';
        case 'json':        return 'NVARCHAR(MAX)';        // + ISJSON() 제약 권장
        case 'uuid':        return 'UNIQUEIDENTIFIER';
        default:            return 'VARCHAR(MAX)';
      }
    },
    sqlite() {
      switch (type) {
        case 'int': case 'bigint':     return 'INTEGER';
        case 'numeric':                return 'NUMERIC';
        case 'real': case 'double':    return 'REAL';
        case 'boolean':                return 'INTEGER';   // 0/1
        case 'varchar': case 'text':   return 'TEXT';
        case 'date': case 'time':
        case 'timestamp': case 'timestamptz': return 'NUMERIC'; // 또는 TEXT
        case 'binary': case 'varbinary': case 'blob': return 'BLOB';
        case 'json':                    return 'TEXT';
        case 'uuid':                    return 'TEXT';
        default:                        return 'TEXT';
      }
    },
    oracle() {
      switch (type) {
        case 'int':         return 'NUMBER(10)';
        case 'bigint':      return 'NUMBER(19)';
        case 'numeric':     return `NUMBER${L('') || '(18,0)'}`;
        case 'real':        return 'BINARY_FLOAT';
        case 'double':      return 'BINARY_DOUBLE';
        case 'boolean':     return 'NUMBER(1)';            // 또는 CHAR(1) 'Y'/'N'
        case 'varchar':     return `VARCHAR2${L('(255)')}`;
        case 'text':        return 'CLOB';
        case 'date':        return 'DATE';
        case 'time':        return 'DATE';                 // 시:분:초 포함
        case 'timestamp':   return 'TIMESTAMP';
        case 'timestamptz': return 'TIMESTAMP WITH TIME ZONE';
        case 'binary':      return `RAW${L('(16)')}`;
        case 'varbinary':   return `RAW${L('(255)')}`;
        case 'blob':        return 'BLOB';
        case 'json':        return 'JSON';                 // 12c+
        case 'uuid':        return 'RAW(16)';              // 또는 CHAR(36)
        default:            return 'CLOB';
      }
    }
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
    'int', 'bigint', 'numeric', 'real', 'double', 'boolean',
    'varchar', 'text', 'date', 'time', 'timestamp', 'timestamptz',
    'binary', 'varbinary', 'blob', 'json', 'uuid'
  ];
  return stdTypes.includes(base.replace(/\s+/g, ''));
}

export { convertStandardToVendor, convertVendorToStandard, isStandardType };
