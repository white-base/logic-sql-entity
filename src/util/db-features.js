// ================= MySQL =================
export const resolveMySqlFeatures = (version = '') => {
  const [M, m, t] = version.split('.').map(x => parseInt(x || '0', 10));
  const major = M || 0, minor = m || 0, patch = t || 0;

  const gte = (a, b, c) => {
    if (major > a) return true;
    if (major < a) return false;
    if (minor > b) return true;
    if (minor < b) return false;
    return patch >= c;
  };

  return {
    supportsCTE: gte(8, 0, 0),
    supportsWindow: gte(8, 0, 0),
    supportsJsonType: gte(5, 7, 8),     // 5.7.8+
    enforcesCheck: gte(8, 0, 16),       // 8.0.16+
    supportsDescIndex: gte(8, 0, 13),   // 8.0.13+
    hasReturning: false                 // X (일부 MariaDB는 가능)
  };
};

// ================= SQL Server =================
export const resolveSqlServerFeatures = (version = '') => {
  const major = parseInt((version.split('.')[0] || '0'), 10) || 0;

  return {
    supportsCTE: major >= 9,            // 2005+
    supportsOutput: major >= 9,         // 2005+
    supportsJsonFuncs: major >= 13,     // 2016+
    supportsCreateOrAlter: major >= 13, // 2016+
    supportsOffsetFetch: major >= 11    // 2012+
  };
};

// ================= PostgreSQL =================
export const resolvePostgresFeatures = (version = '') => {
  // 예: '15.3' → [15,3]
  const [M, m] = version.split('.').map(x => parseInt(x || '0', 10));
  const major = M || 0, minor = m || 0;

  const gte = (a, b) => (major > a) || (major === a && minor >= b);

  return {
    supportsCTE: gte(8, 4),             // 8.4+
    supportsWindow: gte(8, 4),          // 8.4+
    supportsJsonType: gte(9, 2),        // JSON 9.2+, JSONB 9.4+
    enforcesCheck: true,                 // 항상 지원
    supportsDescIndex: true,             // 항상 지원
    hasReturning: gte(8, 2),             // 8.2+
    supportsUpsert: gte(9, 5),           // ON CONFLICT 9.5+
    supportsGeneratedCols: gte(12, 0)    // 12.0+
  };
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

  return {
    supportsCTE: gte(3, 8, 3),          // 3.8.3+
    supportsWindow: gte(3, 25, 0),      // 3.25.0+
    supportsJsonFuncs: gte(3, 38, 0),   // 3.38.0+ (JSON functions)
    enforcesCheck: true,                 // CHECK 제약조건은 오래전부터
    supportsDescIndex: true,             // 항상 지원
    hasReturning: gte(3, 35, 0),        // 3.35.0+ RETURNING 지원
    supportsGeneratedCols: gte(3, 31, 0) // 3.31.0+
  };
};

export const resolveDbFeatures = (kind = 'unknown', version = '') => {
  switch (kind) {
    case 'mysql':
      return resolveMySqlFeatures(version);
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
