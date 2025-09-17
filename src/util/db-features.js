const defaultFeatureSet = {
  supportsCTE: false,
  supportsWindow: false,
  supportsJsonType: false,
  supportsJsonFuncs: false,
  enforcesCheck: false,
  supportsDescIndex: false,
  hasReturning: false,
  supportsUpsert: false,
  supportsGeneratedCols: false,
  supportsOutput: false,
  supportsCreateOrAlter: false,
  supportsOffsetFetch: false
};

function mergeFeatures(vendorFeatures) {
  return { ...defaultFeatureSet, ...vendorFeatures };
}
// ================= MySQL =================
const parseMySqlStyleVersion = (version = '') => {
  const [M, m, t] = String(version).split('.').map(x => parseInt(x || '0', 10));
  const major = Number.isFinite(M) ? M : 0;
  const minor = Number.isFinite(m) ? m : 0;
  const patch = Number.isFinite(t) ? t : 0;

  const gte = (a, b, c) => {
    if (major > a) return true;
    if (major < a) return false;
    if (minor > b) return true;
    if (minor < b) return false;
    return patch >= c;
  };

  return { major, minor, patch, gte };
};

export const resolveMySqlFeatures = (version = '') => {
  const { gte } = parseMySqlStyleVersion(version);

  return mergeFeatures({
    supportsCTE: gte(8, 0, 0),
    supportsWindow: gte(8, 0, 0),
    supportsJsonType: gte(5, 7, 8),     // 5.7.8+
    enforcesCheck: gte(8, 0, 16),       // 8.0.16+
    supportsDescIndex: gte(8, 0, 13),   // 8.0.13+
    hasReturning: false                 // X (일부 MariaDB는 가능)
  });
};

// ================= MariaDB =================
export const isMariaDbVersion = (version = '') => {
  const s = String(version).toLowerCase();
  if (s.includes('mariadb')) return true;
  const { major } = parseMySqlStyleVersion(version);
  // MariaDB uses 10.x series (e.g., 10.3, 10.4, 10.5, 10.6, 10.11...).
  // Oracle MySQL does not have 10.x. Good heuristic in absence of tokens.
  return major >= 10;
};

export const resolveMariaDbFeatures = (version = '') => {
  const { gte } = parseMySqlStyleVersion(version);
  return mergeFeatures({
    supportsCTE: gte(10, 2, 1),         // 10.2.1+
    supportsWindow: gte(10, 2, 0),      // 10.2+
    supportsJsonType: false,            // No native JSON type
    supportsJsonFuncs: gte(10, 2, 0),   // JSON functions 10.2+
    enforcesCheck: gte(10, 2, 1),       // CHECK enforced 10.2.1+
    supportsDescIndex: false,           // Historically ignored; be conservative
    hasReturning: gte(10, 5, 0),        // DML RETURNING 10.5+
    supportsGeneratedCols: gte(10, 2, 0)
  });
};

// ================= SQL Server =================
export const resolveSqlServerFeatures = (version = '') => {
  const major = parseInt((version.split('.')[0] || '0'), 10) || 0;

  return mergeFeatures({
    supportsCTE: major >= 9,            // 2005+
    supportsOutput: major >= 9,         // 2005+
    supportsJsonFuncs: major >= 13,     // 2016+
    supportsCreateOrAlter: major >= 13, // 2016+
    supportsOffsetFetch: major >= 11    // 2012+
  });
};

// ================= PostgreSQL =================
export const resolvePostgresFeatures = (version = '') => {
  // 예: '15.3' → [15,3]
  const [M, m] = version.split('.').map(x => parseInt(x || '0', 10));
  const major = M || 0, minor = m || 0;

  const gte = (a, b) => (major > a) || (major === a && minor >= b);

  return mergeFeatures({
    supportsCTE: gte(8, 4),             // 8.4+
    supportsWindow: gte(8, 4),          // 8.4+
    supportsJsonType: gte(9, 2),        // JSON 9.2+, JSONB 9.4+
    enforcesCheck: true,                 // 항상 지원
    supportsDescIndex: true,             // 항상 지원
    hasReturning: gte(8, 2),             // 8.2+
    supportsUpsert: gte(9, 5),           // ON CONFLICT 9.5+
    supportsGeneratedCols: gte(12, 0)    // 12.0+
  });
};

// ================= SQLite =================
export const resolveSqliteFeatures = (version = '') => {
  // 예: '3.44.2' → [3,44,2]
  const [M, m, t] = version.split('.').map(x => parseInt(x || '0', 10));
  const major = M || 0, minor = m || 0, patch = t || 0;

  const gte = (a, b, c) => {
    if (major > a) return true;
    if (major < a) return false;
    if (minor > b) return true;
    if (minor < b) return false;
    return patch >= c;
  };

  return mergeFeatures({
    supportsCTE: gte(3, 8, 3),          // 3.8.3+
    supportsWindow: gte(3, 25, 0),      // 3.25.0+
    supportsJsonFuncs: gte(3, 38, 0),   // 3.38.0+ (JSON functions)
    enforcesCheck: true,                 // CHECK 제약조건은 오래전부터
    supportsDescIndex: true,             // 항상 지원
    hasReturning: gte(3, 35, 0),        // 3.35.0+ RETURNING 지원
    supportsGeneratedCols: gte(3, 31, 0) // 3.31.0+
  });
};

export const resolveDbFeatures = (kind = 'unknown', version = '') => {
  switch (kind) {
    case 'mysql':
      return isMariaDbVersion(version)
        ? resolveMariaDbFeatures(version)
        : resolveMySqlFeatures(version);
    case 'postgres':
      return resolvePostgresFeatures(version);
    case 'sqlite':
      return resolveSqliteFeatures(version);
    case 'mssql':
      return resolveSqlServerFeatures(version);
    default:
      return {};
  }
};
