import { sql }                          from 'kysely';

export function applyDefault(colBuilder, def, vendor) {

    if (!def) return colBuilder;

    if (typeof def === 'string' || typeof def === 'number' || typeof def === 'boolean') {
        // 단순 리터럴
        return colBuilder.defaultTo(def);
    }

    if (def instanceof Date) {
        // 날짜 리터럴
        return colBuilder.defaultTo(def.toISOString());
    }


    switch (def.kind) {
    case 'literal':
        // 단순 리터럴(문자열/숫자/불리언)
        return colBuilder.defaultTo(def.value);

    case 'now':
        // 현재시각
        // 대부분 CURRENT_TIMESTAMP 로 커버
        return colBuilder.defaultTo(sql`CURRENT_TIMESTAMP`);

    case 'uuid':
        if (vendor === 'postgres') {
            // 확장 상황에 맞게 하나 선택
            return colBuilder.defaultTo(sql`gen_random_uuid()`);
            // 또는: return colBuilder.defaultTo(sql`uuid_generate_v4()`);
        } else if (vendor === 'mysql') {
            return colBuilder.defaultTo(sql`UUID()`);
        } else if (vendor === 'mssql') {
            return colBuilder.defaultTo(sql`NEWID()`);
        } else {
            // sqlite 대체식
            return colBuilder.defaultTo(sql`lower(hex(randomblob(16)))`);
        }

    case 'json':
        if (vendor === 'postgres') {
            return colBuilder.defaultTo(sql`'{}'::jsonb`);
        } else if (vendor === 'mysql') {
            // 주의: MySQL JSON 기본값은 환경/버전에 따라 제한. 안전하게 NULL 유지 권장.
            // 필요 시 체크 후 허용되면 아래와 같이:
            // return colBuilder.defaultTo(sql`JSON_OBJECT()`);
            return colBuilder; // 기본값 미지정 → 애플리케이션/트리거로 초기화
        } else {
            // sqlite/mssql: 문자열로 저장
            return colBuilder.defaultTo('{}');
        }

        // 필요 시 확장 포인트
    case 'sql':
        // def.sql 은 sql`...` 표현식이라고 가정
        return colBuilder.defaultTo(def.sql);

    default:
        return colBuilder;
    }
}

// 사용 예제:
// import { applyDefault } from './apply-default';
// import { sql } from 'kysely';

// 예시: 문자열 리터럴 기본값
// applyDefault(column['name'], { kind: 'literal', value: 'kim' }, 'postgres');

// 예시: 현재시각 기본값
// applyDefault(column['created_at'], { kind: 'now' }, 'mysql');

// 예시: UUID 기본값
// applyDefault(column['id'], { kind: 'uuid' }, 'postgres');

// 예시: JSON 기본값
// applyDefault(column['meta'], { kind: 'json' }, 'postgres');

// 예시: SQL 표현식 기본값
// applyDefault(column['score'], { kind: 'sql', sql: sql`42` }, 'sqlite');
