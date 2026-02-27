// db-info-util.mjs
import { sql } from 'kysely';

/**
 * Dialect 인스턴스에서 DB 종류 추론
 * @param {object} dialect Kysely Dialect 인스턴스
 * @returns {'sqlite'|'mysql'|'postgres'|'mssql'|'unknown'}
 */
export function inferDbKind(dialect) {
    if (!dialect) return 'unknown';
    const name = (dialect.constructor && dialect.constructor.name)
        ? String(dialect.constructor.name).toLowerCase()
        : '';

    if (name.includes('sqlite')) return 'sqlite';
    if (name.includes('mysql')) return 'mysql';           // mysql/mariadb 공통
    if (name.includes('postgres')) return 'postgres';
    if (name.includes('sqlserver') || name.includes('mssql')) return 'mssql';
    return 'unknown';
}

/**
 * DB 종류별 버전 조회 RawBuilder 반환
 * @param {'sqlite'|'mysql'|'postgres'|'mssql'|'unknown'} kind
 */
export function getVersionQuery(kind) {
    switch (kind) {
    case 'sqlite':
        return sql`SELECT sqlite_version() AS version, 'sqlite' AS comment`;
    case 'mysql':
        // MySQL/MariaDB: 버전 + 코멘트(벤더 정보)
        return sql`SELECT @@version AS version, @@version_comment AS comment`;
    case 'postgres':
        // Postgres: 노이즈 없는 순수 버전, 코멘트는 비움
        return sql`SELECT current_setting('server_version') AS version, NULL::text AS comment`;
    case 'mssql':
        return sql`SELECT @@VERSION AS version`;
    default:
        return sql`SELECT 'unknown' AS version`;
    }
}

function detectFlavor(kind, rawResult, versionStr) {
    try {
        if (kind !== 'mysql') return null;

        // 우선 comment 컬럼
        let comment = null;
        if (rawResult?.rows?.length) comment = rawResult.rows[0]?.comment ?? null;
        if (!comment && Array.isArray(rawResult) && rawResult.length) {
            const row = rawResult[0];
            if (row && typeof row === 'object') comment = row.comment ?? null;
        }

        const hay = `${versionStr || ''} ${(comment || '')}`.toLowerCase();
        if (hay.includes('mariadb')) return 'mariadb';
        // MariaDB는 보통 10.x 버전 체계를 사용
        const [M] = String(versionStr || '').split('.');
        const major = parseInt(M || '0', 10) || 0;
        if (major >= 10) return 'mariadb';
        return 'mysql';
    } catch (_) {
        return null;
    }
}

/**
 * 드라이버별 결과 포맷 차이를 흡수하여 문자열 버전만 뽑아냄
 */
export function normalizeVersionResult(result) {
    try {
        if (!result) return null;

        // 케이스1: { rows: [...] }
        if (result.rows && result.rows.length) {
            const row = result.rows[0];
            if (row.version != null) return String(row.version);
            for (const k in row) return String(row[k]);
            return null;
        }

        // 케이스2: 배열 형태
        if (Array.isArray(result) && result.length) {
            const row = result[0];
            if (row && typeof row === 'object') {
                if (row.version != null) return String(row.version);
                for (const k in row) return String(row[k]);
                return null;
            }
            return String(row);
        }

        // 케이스3: 스칼라
        if (typeof result === 'string') return result;
        if (typeof result === 'number') return String(result);
    } catch (_) {
    // 무시
    }
    return null;
}

/**
 * DB 메타정보 감지 후 ctx.__dbInfo에 저장
 * ctx.db: Kysely 인스턴스
 * ctx.connect.dialect: Dialect 인스턴스
 *
 * @param {object} ctx         예: ctx_prt_core
 * @param {{force?: boolean}} [opt]
 * @returns {Promise<{kind:string, version:string|null, detectedAt:string}>}
 */
export async function detectAndStoreDbInfo(ctx, opt = {}) {
    if (!ctx?.db || !ctx?.connect?.dialect) {
        throw new Error('ctx.db 또는 ctx.connect.dialect가 없습니다.');
    }
    if (ctx.__dbInfo && !opt.force) return ctx.__dbInfo;

    const kind = inferDbKind(ctx.connect.dialect);
    const q = getVersionQuery(kind);

    let rawResult;
    try {
    // 표준 경로
        rawResult = await q.execute(ctx.db);
    } catch {
    // 폴백 경로
        try {
            rawResult = await ctx.db.executeQuery(q.compile(ctx.db));
        } catch {
            rawResult = null;
        }
    }

    const version = normalizeVersionResult(rawResult);
    const info = {
        kind,                       // 'sqlite' | 'mysql' | 'postgres' | 'mssql' | 'unknown'
        version,                    // 예: '3.44.2', '8.0.36', 'Microsoft SQL Server 2019...' 등
        detectedAt: new Date().toISOString(),
        flavor: detectFlavor(kind, rawResult, version) // mysql 계열일 때 'mysql' | 'mariadb'
    };

    ctx.__dbInfo = info;
    return info;
}

/**
 * 저장된 DB 정보 읽기
 */
export function getDbInfo(ctx) {
    return ctx?.__dbInfo ?? null;
}

/**
 * dialect 지정과 동시에 강제 감지
 * @param {object} ctx
 * @param {object} dialect Kysely Dialect 인스턴스
 */
export async function setDialectAndDetect(ctx, dialect) {
    if (!ctx) throw new Error('ctx가 필요합니다.');
    ctx.connect ??= {};
    ctx.connect.dialect = dialect;
    return detectAndStoreDbInfo(ctx, { force: true });
}
