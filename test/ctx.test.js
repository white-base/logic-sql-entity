// import { jest } from '@jest/globals';
import { expect, jest }     from '@jest/globals';
import {MetaRegistry} from 'logic-entity';

import { SqliteDialect, sql } from 'kysely'
import Database from 'better-sqlite3'
import { ctx_v1 } from './module/ctx_v1/index.js';

//==============================================================
// test
describe("[target: ctx.js]", () => {
    // let dbFile = 'mydb-ctx-test.sqlite';
    let dbFile = ':memory:';


    beforeAll(async () => {
        jest.resetModules();
        MetaRegistry.init();

        ctx_v1.connect = {
            dialect: new SqliteDialect({
                database: new Database(dbFile)
            }),
            log(event) {
                if (event.level === 'query') {
                console.log('SQL:', event.query.sql);
                console.log('Params:', event.query.parameters);
                }
            }
        };
        await ctx_v1.init();

        const db = ctx_v1.db;
        await sql`PRAGMA foreign_keys = ON`.execute(db);    // FK 제약조건 설정
        await sql`PRAGMA journal_mode = WAL`.execute(db);   // 동시성 및 복구력 향상
        await sql`PRAGMA synchronous = NORMAL`.execute(db); // 성능 향상

        // 기존에 테이블이 있으면 삭제
        // SQLite: DROP TABLE 시 FK 무시(오류 없음)
        // MySQL, PostgreSQL, MSSQL 등: DROP TABLE 시 FK 위반 시 오류 발생(순서 중요)
        await sql`DROP TABLE IF EXISTS sto_account`.execute(db);
        await sql`DROP TABLE IF EXISTS sto_master`.execute(db);
        await sql`DROP TABLE IF EXISTS meb_account`.execute(db);
        await sql`DROP TABLE IF EXISTS meb_master`.execute(db);

        await ctx_v1.createSchema();
    });
    afterAll(async () => {
        const db = ctx_v1.db;
        await db.destroy();
    });

    describe("SQLRowCollection :: 클래스", () => {
        beforeEach(() => {
            // jest.resetModules();
            // MetaRegistry.init();
        });
        describe(" ctx 생성", () => {
            it("sto_account 테이블이 생성되어야 한다", async () => {
                const db = ctx_v1.db;
                const result = await sql`SELECT name FROM sqlite_master WHERE type='table' AND name='sto_account'`.execute(db);
                const row = result.rows[0];
                expect(row).toBeDefined();
                expect(row.name).toBe('sto_account');
            });
        });
    });
});