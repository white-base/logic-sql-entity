import { expect, jest } from '@jest/globals';
// import { createTestDB } from './db.js'
import { MetaRegistry } from 'logic-entity';

import { SQLTable } from '../src/sql-table.js';

import { SqliteDialect } from 'kysely';
import Database from 'better-sqlite3';

import { MysqlDialect } from 'kysely';
import mysql from 'mysql2';
import { Kysely } from 'kysely';

//==============================================================
// test
let db;

describe('[target: sql-table.js]', () => {
    describe('SQLTable :: 클래스', () => {
        beforeEach(() => {
            // jest.resetModules();
            MetaRegistry.init();
        });

        describe('<테이블 등록후 속성 검사>', () => {
            it('- 테이블 등록후 속성 검사 ', () => {
                const table1 = new SQLTable('T1');
                const table2 = new SQLTable('T2');
                table1.columns.add('c1');
                table1.columns.add('c2');
                table1.columns['c1'].value = 'R1';
                table1.columns['c2'].value = 'R2';
                table2.columns.add('c1');
                table2.columns.add(table1.columns['c2']); // 내부 복제됨

                // table1
                expect(table1.columns['c1'].value).toBe('R1');
                expect(table1.columns['c2'].value).toBe('R2');
                expect(table1.tableName).toBe('T1');
                expect(table1.columns['c1']._entity.tableName).toBe('T1');
                expect(table1.columns['c2']._entity.tableName).toBe('T1');
                // table2
                expect(table2.columns['c1'].value).toBe('');
                expect(table2.columns['c2'].value).toBe('R2');
                expect(table2.tableName).toBe('T2');
                expect(table2.columns['c1']._entity.tableName).toBe('T2');
                expect(table2.columns['c2']._entity.tableName).toBe('T2');
            });
        });
    });

    describe('Kysely + Jest (ESM JS)', () => {
        beforeAll(async () => {
            // db = createTestDB()
            db = new Kysely({
                dialect: new SqliteDialect({
                    database: new Database(':memory:')
                })
            });

            // 스키마 생성
            await db.schema
                .createTable('person')
                .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
                .addColumn('name', 'text', (col) => col.notNull())
                .addColumn('age', 'integer', (col) => col.notNull())
                .execute();
        });

        afterAll(async () => {
            await db.destroy();
        });

        it('INSERT & SELECT', async () => {
            await db.insertInto('person').values({ name: '홍길동', age: 30 }).execute();

            const rows = await db.selectFrom('person').selectAll().execute();
            expect(rows.length).toBe(1);
            expect(rows[0].name).toBe('홍길동');
            expect(rows[0].age).toBe(30);
        });

        it('UPDATE', async () => {
            await db.updateTable('person').set({ age: 31 }).where('name', '=', '홍길동').execute();

            const row = await db
                .selectFrom('person')
                .select(['name', 'age'])
                .where('name', '=', '홍길동')
                .executeTakeFirst();

            expect(row?.age).toBe(31);
        });

        it('DELETE', async () => {
            await db.deleteFrom('person').where('name', '=', '홍길동').execute();

            const rows = await db.selectFrom('person').selectAll().execute();
            expect(rows.length).toBe(0);
        });

        it('insert SQLTable', async () => {
            const table = new SQLTable('person');
            const conn = {
                dialect: new SqliteDialect({
                    database: new Database(':memory:')
                    // database: new Database('sql-table-test.sqlite')
                })
            };
            table.connect = conn;
            await table.init();
            table.columns.add('id', { primaryKey: true });
            table.columns.add('name');
            table.columns.add('age');

            await table.db.schema.dropTable('person').ifExists().execute();
            // 스키마 생성
            // 테이블 존재 여부 검사 후 생성
            await table.db.schema
                .createTable('person')
                .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
                .addColumn('name', 'text', (col) => col.notNull())
                .addColumn('age', 'integer', (col) => col.notNull())
                .execute();

            // table.connect = {
            //     driver: 'sqlite3',
            //     database: ':memory:',
            //     // connection: 'Server=.;Database=app;User Id=sa;Password=***;'
            // };

            await table.insert({ name: '홍길동', age: 30 });
            await table.insert({ name: '김로직', age: 40 });
            await table.update({ id: 1, name: '홍길동2', age: 32 });
            await table.delete({ id: 2 });

            table.rows.add({ id: 3, name: '이순신', age: 50 }); // TODO: id 값이 존재햐야함
            table.rows[0].name = '이순신2';

            await table.acceptChanges();

            // await db.insertInto('person').values(table.rows.toArray()).execute();

            const rows = await table.db.selectFrom('person').selectAll().execute();
            expect(rows.length).toBe(2);
            expect(rows[0].name).toBe('홍길동2');
            expect(rows[0].age).toBe(32);
            // expect(rows[1].name).toBe('김로직');
            // expect(rows[1].age).toBe(40);
            expect(rows[1].name).toBe('이순신2');
            expect(rows[1].age).toBe(50);
            expect(table.getChanges().length).toBe(0);
        });

        it('sqlite3 SQLTable', async () => {
            const table = new SQLTable('person');
            const conn = {
                dialect: new SqliteDialect({
                    database: new Database(':memory:')
                })
            };
            table.connect = conn;
            await table.init();

            table.columns.add('id', { primaryKey: true, autoIncrement: true, nullable: false });
            table.columns.add('name', { nullable: false });
            table.columns.add('age', { nullable: false });

            // 스키마 생성
            await table.db.schema
                .createTable('person')
                .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
                .addColumn('name', 'text', (col) => col.notNull())
                .addColumn('age', 'integer', (col) => col.notNull())
                .execute();

            table.connect = {
                driver: 'sqlite3',
                database: ':memory:'
            };

            table.rows.add({ id: 1, name: '홍길동', age: 30 });
            table.rows.add({ id: 2, name: '김로직', age: 40 });
            table.rows.add({ id: 3, name: '이순신', age: 50 });

            await table.acceptChanges();

            const rows = await table.db.selectFrom('person').selectAll().execute();
            expect(rows.length).toBe(3);
            expect(rows[0].name).toBe('홍길동');
            expect(rows[0].age).toBe(30);
            expect(rows[1].name).toBe('김로직');
            expect(rows[1].age).toBe(40);
            expect(rows[2].name).toBe('이순신');
            expect(rows[2].age).toBe(50);
            expect(table.getChanges().length).toBe(0);

            table.rows[0].name = '홍길동2';
            table.rows[0].age = 32;
            await table.acceptChanges();

            const rows2 = await table.db.selectFrom('person').selectAll().execute();

            expect(rows2.length).toBe(3);
            expect(rows2[0].name).toBe('홍길동2');
            expect(rows2[0].age).toBe(32);

            const rows3 = await table.select({ page: 1, size: 10 }, { clearRows: false });

            expect(rows3.length).toBe(3);
            expect(table.getChanges().length).toBe(3);
            expect(table.rows.count).toBe(6);

            // table.insert({ name: '강감찬', age: 60 });
        });

        it('getCreateDDL', async () => {
            const table = new SQLTable('person');
            const conn = {
                dialect: new SqliteDialect({
                    database: new Database(':memory:')
                })
            };
            table.connect = conn;
            table.columns.add('id', { dataType: 'int', primaryKey: true, autoIncrement: true, nullable: false });
            table.columns.add('email', { dataType: 'varchar(255)', unique: true, nullable: false, indexes: 'em' });
            table.columns.add('updated_at', { dataType: 'timestamp', nullable: true, defaultValue: { kind: 'now' }, onUpdateValue: { kind: 'now' } });
            await table.init();

            // const sql = await table.getCreateSQL();
            const sql = await table.create({ dryRun: true });

            expect(sql.length).toBe(2);
            expect(sql[0].sql).toBe(
                `create table \"person\" (\"id\" integer not null primary key autoincrement, \"email\" text not null unique, \"updated_at\" numeric default CURRENT_TIMESTAMP)`
            );
            expect(sql[1].sql).toBe(`create index "idx_person_em_email" on "person" ("email")`);

            const dropSql = await table.drop({ dryRun: true });
            expect(dropSql.sql).toBe(`drop table if exists "person"`);
        });

        // REVIEW: docker로 mysql 서버 띄워서 테스트 해야함
        it.skip('insert SQLTable3 mysql', async () => {
            const table = new SQLTable('person');
            const conn = {
                dialect: new MysqlDialect({
                    pool: mysql.createPool({
                        host: 'localhost', // MySQL 서버 주소
                        port: 3306, // 포트 (기본값 3306)
                        user: 'testuser', // 사용자명
                        password: 'testpw', // 비밀번호
                        database: 'testdb', // 사용할 데이터베이스명
                        connectionLimit: 10 // 커넥션 풀 최대 개수
                    })
                })
            };
            table.connect = conn;

            table.columns.add('id');
            table.columns.add('name');
            table.columns.add('age');

            try {
                await table.db.schema.dropTable('person').ifExists().execute();
            } catch (err) {
                // 무시: 테이블이 없을 경우
            }
            // 스키마 생성
            await table.db.schema
                .createTable('person')
                .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
                .addColumn('name', 'text', (col) => col.notNull())
                .addColumn('age', 'integer', (col) => col.notNull())
                .execute();

            // await table.db
            //     .deleteFrom('person') // 삭제할 테이블
            //     .execute();

            await table.insert({ name: '홍길동', age: 30 });
            await table.insert({ name: '김로직', age: 40 });
            await table.insert({ name: '이순신', age: 50 });

            await table.acceptChanges();

            const rows = await table.db.selectFrom('person').selectAll().execute();
            expect(rows.length).toBe(3);
            expect(rows[0].name).toBe('홍길동');
            expect(rows[0].age).toBe(30);
            expect(rows[1].name).toBe('김로직');
            expect(rows[1].age).toBe(40);
            expect(rows[2].name).toBe('이순신');
            expect(rows[2].age).toBe(50);
            expect(table.getChanges().length).toBe(0);

            await table.select(1, 10);

            table.rows[0].name = '홍길동2';
            table.rows[0].age = 32;
            await table.acceptChanges();

            const rows2 = await table.db.selectFrom('person').selectAll().execute();

            expect(rows2.length).toBe(6);
            expect(rows2[0].name).toBe('홍길동2');
            expect(rows2[0].age).toBe(32);

            const rows3 = await table.select(1, 10);

            expect(rows3.length).toBe(6);
            expect(table.getChanges().length).toBe(6);
            expect(table.rows.count).toBe(9);

            // await table.db.schema
            //     .dropTable('person') // 삭제할 테이블명
            //     .ifExists()         // 존재할 때만 실행 (옵션)
            //     .cascade()          // 외래키 제약조건까지 함께 삭제 (옵션)
            //     .execute()

            table.db.destroy();
        });

        describe('delete() method tests', () => {
            let table;
            let conn;

            beforeEach(async () => {
                table = new SQLTable('test_person');
                conn = {
                    dialect: new SqliteDialect({
                        database: new Database(':memory:')
                    })
                };
                table.connect = conn;
                await table.init();

                // Setup columns
                table.columns.add('id', { primaryKey: true, autoIncrement: true, nullable: false });
                table.columns.add('name', { nullable: false });
                table.columns.add('age', { nullable: false });

                // Create table
                await table.db.schema
                    .createTable('test_person')
                    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
                    .addColumn('name', 'text', (col) => col.notNull())
                    .addColumn('age', 'integer', (col) => col.notNull())
                    .execute();

                // Insert test data
                await table.db.insertInto('test_person')
                    .values([
                        { name: '홍길동', age: 30 },
                        { name: '김로직', age: 40 },
                        { name: '이순신', age: 50 }
                    ])
                    .execute();
            });

            afterEach(async () => {
                await table.db.destroy();
            });

            it.skip('requireTrx=true이고 트랜잭션이 제공되지 않을 때 오류를 발생시켜야 함', async () => {
                const whereClause = { id: 1 };
                const options = { requireTrx: true };

                await expect(table.delete(whereClause, options)).rejects.toThrow(
                    'delete requires an explicit transaction (requireTrx=true).'
                );
            });

            it('트랜잭션과 함께 단일 행을 삭제해야 함', async () => {
                const trx = await table.db.transaction().execute(async (trx) => {
                    const whereClause = { id: 1 };
                    const options = { trx, maxDeletableRows: 1 };

                    const result = await table.delete(whereClause, options);

                    expect(result).toBe(1);

                    // Verify deletion
                    const remaining = await trx.selectFrom('test_person').selectAll().execute();
                    expect(remaining.length).toBe(2);
                    expect(remaining.find((r) => r.id === 1)).toBeUndefined();
                });
            });

            it('dryRun=true일 때 컴파일된 SQL을 반환해야 함', async () => {
                const trx = await table.db.transaction().execute(async (trx) => {
                    const whereClause = { id: 1 };
                    const options = { trx, dryRun: true };

                    const result = await table.delete(whereClause, options);

                    expect(result).toHaveProperty('sql');
                    expect(result.sql).toContain('delete from');
                    expect(result.sql).toContain('test_person');

                    // Verify no actual deletion occurred
                    const rows = await trx.selectFrom('test_person').selectAll().execute();
                    expect(rows.length).toBe(3);
                });
            });

            it('영향받은 행 수가 maxDeletableRows를 초과할 때 오류를 발생시켜야 함', async () => {
                const trx = await table.db.transaction().execute(async (trx) => {
                    // Insert multiple rows with same condition to exceed limit
                    await trx
                        .insertInto('test_person')
                        .values([
                            { name: '테스트1', age: 25 },
                            { name: '테스트2', age: 25 }
                        ])
                        .execute();

                    const whereClause = { age: 25 };
                    const options = { trx, maxDeletableRows: 1 };

                    await expect(table.delete(whereClause, options)).rejects.toThrow(
                        'affectedRows 2 exceeds limit 1'
                    );
                });
            });

            it('삭제 전후 이벤트를 발생시켜야 함', async () => {
                const deletingHandler = jest.fn();
                const deletedHandler = jest.fn();

                table.onDeleting(deletingHandler);
                table.onDeleted(deletedHandler);

                const trx = await table.db.transaction().execute(async (trx) => {
                    const whereClause = { id: 1 };
                    const options = { trx, maxDeletableRows: 1 };

                    await table.delete(whereClause, options);

                    expect(deletingHandler).toHaveBeenCalledWith({
                        table: table,
                        db: trx,
                        options: options
                    });

                    expect(deletedHandler).toHaveBeenCalledWith({
                        table: table,
                        db: trx,
                        options: expect.objectContaining({
                            trx,
                            maxDeletableRows: 1
                        })
                    });
                });
            });

            it('삭제 중 오류 발생 시 deleteError 이벤트를 발생시켜야 함', async () => {
                const deleteErrorHandler = jest.fn();
                table.onDeleteFailed(deleteErrorHandler);

                try {
                    await table.db.transaction().execute(async (trx) => {
                        // Force an error by providing invalid where clause
                        const whereClause = {}; // No PK columns
                        const options = { trx };

                        await table.delete(whereClause, options);
                    });
                } catch (error) {
                    // Error is expected
                }

                expect(deleteErrorHandler).toHaveBeenCalledWith({
                    table: table,
                    db: expect.any(Object),
                    options: expect.objectContaining({ trx: expect.any(Object) }),
                    error: expect.any(Error)
                });
            });

            // it('삭제 결과를 올바르게 정규화해야 함', () => {
            //     // Test array result
            //     const arrayResult = [{ id: 1 }, { id: 2 }];
            //     const normalized1 = table._normalizeDeleteResult(arrayResult);
            //     expect(normalized1).toEqual({ affectedRows: 2, rows: arrayResult });

            //     // Test numDeletedRows result
            //     const numDeletedResult = { numDeletedRows: 3 };
            //     const normalized2 = table._normalizeDeleteResult(numDeletedResult);
            //     expect(normalized2).toEqual({ affectedRows: 3 });

            //     // Test affectedRows result
            //     const affectedRowsResult = { affectedRows: 1 };
            //     const normalized3 = table._normalizeDeleteResult(affectedRowsResult);
            //     expect(normalized3).toEqual({ affectedRows: 1 });

            //     // Test fallback
            //     const unknownResult = { someProperty: 'value' };
            //     const normalized4 = table._normalizeDeleteResult(unknownResult);
            //     expect(normalized4).toEqual({ affectedRows: 0 });
            // });

            it('영향받은 행 수 제한을 올바르게 강제해야 함', () => {
                // Should not throw when within limit
                expect(() => table._enforceAffectLimit(1, 5)).not.toThrow();
                expect(() => table._enforceAffectLimit(5, 5)).not.toThrow();

                // Should throw when exceeding limit
                expect(() => table._enforceAffectLimit(6, 5)).toThrow('affectedRows 6 exceeds limit 5');

                // Should handle null/undefined limits
                expect(() => table._enforceAffectLimit(100, null)).not.toThrow();
                expect(() => table._enforceAffectLimit(100, undefined)).not.toThrow();

                // Should handle non-numeric affected values
                expect(() => table._enforceAffectLimit('invalid', 5)).not.toThrow();
            });

            it('MetaRow 객체로 삭제할 수 있어야 함', async () => {
                const trx = await table.db.transaction().execute(async (trx) => {
                    // Create a MetaRow-like object
                    const metaRow = {
                        id: 2,
                        name: '김로직',
                        age: 40
                    };

                    const options = { trx, maxDeletableRows: 1 };
                    const result = await table.delete(metaRow, options);

                    expect(result).toBe(1);

                    // Verify deletion
                    const remaining = await trx.selectFrom('test_person').selectAll().execute();
                    expect(remaining.length).toBe(2);
                    expect(remaining.find((r) => r.id === 2)).toBeUndefined();
                });
            });

            it('기본 옵션을 올바르게 처리해야 함', async () => {
                const trx = await table.db.transaction().execute(async (trx) => {
                    const whereClause = { id: 3 };
                    const options = {
                        trx,
                        requireTrx: false, // Override default
                        maxDeletableRows: 10 // Override default
                    };

                    const result = await table.delete(whereClause, options);

                    expect(result).toBe(1);
                });
            });
        });

        describe('insert() method tests', () => {
            let table;
            let conn;

            beforeEach(async () => {
                table = new SQLTable('test_person');
                conn = {
                    dialect: new SqliteDialect({
                        database: new Database(':memory:')
                    })
                };
                table.connect = conn;
                await table.init();

                // Setup columns
                table.columns.add('id', { primaryKey: true, autoIncrement: true, nullable: false });
                table.columns.add('name', { nullable: false });
                table.columns.add('age', { nullable: false });
                table.columns.add('email', { nullable: true, unique: true });

                // Create table
                await table.db.schema
                    .createTable('test_person')
                    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
                    .addColumn('name', 'text', (col) => col.notNull())
                    .addColumn('age', 'integer', (col) => col.notNull())
                    .addColumn('email', 'text', (col) => col.unique())
                    .execute();
            });

            afterEach(async () => {
                await table.db.destroy();
            });

            it('객체 데이터로 단일 행을 삽입해야 함', async () => {
                const insertData = { name: '홍길동', age: 30, email: 'hong@test.com' };
                const options = {};

                const result = await table.insert(insertData, options);

                expect(result).toBeDefined();

                // Verify insertion
                const rows = await table.db.selectFrom('test_person').selectAll().execute();
                expect(rows.length).toBe(1);
                expect(rows[0].name).toBe('홍길동');
                expect(rows[0].age).toBe(30);
                expect(rows[0].email).toBe('hong@test.com');
            });

            it('MetaRow 객체로 행을 삽입해야 함', async () => {
                // Create a MetaRow-like object
                const metaRow = {
                    name: '김로직',
                    age: 40,
                    email: 'kim@test.com'
                };

                const options = {};
                const result = await table.insert(metaRow, options);

                expect(result).toBeDefined();

                // Verify insertion
                const rows = await table.db.selectFrom('test_person').selectAll().execute();
                expect(rows.length).toBe(1);
                expect(rows[0].name).toBe('김로직');
                expect(rows[0].age).toBe(40);
                expect(rows[0].email).toBe('kim@test.com');
            });

            it('트랜잭션과 함께 삽입해야 함', async () => {
                await table.db.transaction().execute(async (trx) => {
                    const insertData = { name: '이순신', age: 50 };
                    const options = { trx };

                    const result = await table.insert(insertData, options);

                    expect(result).toBeDefined();

                    // Verify insertion within transaction
                    const rows = await trx.selectFrom('test_person').selectAll().execute();
                    expect(rows.length).toBe(1);
                    expect(rows[0].name).toBe('이순신');
                    expect(rows[0].age).toBe(50);
                });
            });

            it('dryRun=true일 때 컴파일된 SQL을 반환해야 함', async () => {
                const insertData = { name: '강감찬', age: 45 };
                const options = { dryRun: true };

                const result = await table.insert(insertData, options);

                expect(result).toHaveProperty('sql');
                expect(result.sql).toContain('insert into');
                expect(result.sql).toContain('test_person');

                // Verify no actual insertion occurred
                const rows = await table.db.selectFrom('test_person').selectAll().execute();
                expect(rows.length).toBe(0);
            });

            it('삽입 전후 이벤트를 발생시켜야 함', async () => {
                const insertingHandler = jest.fn();
                const insertedHandler = jest.fn();

                table.onInserting(insertingHandler);
                table.onInserted(insertedHandler);

                const insertData = { name: '윤봉길', age: 35 };
                const options = {};

                await table.insert(insertData, options);

                expect(insertingHandler).toHaveBeenCalledWith({
                    table: table,
                    db: expect.any(Object),
                    options: expect.objectContaining({ trx: expect.any(Object) })
                });

                // expect(deleteErrorHandler).toHaveBeenCalledWith({
                //     table: table,
                //     db: expect.any(Object),
                //     options: expect.objectContaining({ trx: expect.any(Object) }),
                //     error: expect.any(Error)
                // });

                expect(insertedHandler).toHaveBeenCalledWith({
                    table: table,
                    db: expect.any(Object),
                    options: expect.objectContaining({})
                });
            });

            it('빈 데이터로 삽입 시 오류를 발생시켜야 함', async () => {
                const insertData = {};
                const options = {};

                await expect(table.insert(insertData, options)).rejects.toThrow();
            });

            it('존재하지 않는 컬럼은 필터링해야 함', async () => {
                const insertData = {
                    name: '정약용',
                    age: 55,
                    nonExistentColumn: 'should be filtered'
                };
                const options = {};

                const result = await table.insert(insertData, options);

                expect(result).toBeDefined();

                // Verify insertion (nonExistentColumn should be ignored)
                const rows = await table.db.selectFrom('test_person').selectAll().execute();
                expect(rows.length).toBe(1);
                expect(rows[0].name).toBe('정약용');
                expect(rows[0].age).toBe(55);
                expect(rows[0]).not.toHaveProperty('nonExistentColumn');
            });

            it('hasReturning 기능이 있을 때 데이터를 반환해야 함', async () => {
                // Mock hasReturning feature
                table.profile.features = { hasReturning: true };

                const insertData = { name: '신사임당', age: 48 };
                const options = {};

                const result = await table.insert(insertData, options);

                expect(result).toBeDefined();
            });

            it('null 값을 올바르게 처리해야 함', async () => {
                const insertData = { name: '허준', age: 42, email: null };
                const options = {};

                const result = await table.insert(insertData, options);

                expect(result).toBeDefined();

                // Verify insertion with null value
                const rows = await table.db.selectFrom('test_person').selectAll().execute();
                expect(rows.length).toBe(1);
                expect(rows[0].name).toBe('허준');
                expect(rows[0].age).toBe(42);
                expect(rows[0].email).toBeNull();
            });

            it('insertBuilder 메서드가 올바른 빌더를 반환해야 함', async () => {
                const insertData = { name: '세종대왕', age: 52 };
                const options = { trx: table.db };

                const builder = table.insertBuilder(insertData, options);

                expect(builder).toBeDefined();
                expect(typeof builder.execute).toBe('function');

                const compiled = builder.compile();
                expect(compiled.sql).toContain('insert into');
                expect(compiled.sql).toContain('test_person');
            });

            it('$getColumns 메서드를 올바르게 사용해야 함', async () => {
                const insertData = {
                    name: '장영실',
                    age: 38,
                    invalidColumn: 'test'
                };

                const processedData = table.$getColumns(insertData, 'data');

                expect(processedData).toHaveProperty('name', '장영실');
                expect(processedData).toHaveProperty('age', 38);
                expect(processedData).not.toHaveProperty('invalidColumn');
            });

            it('결과를 올바르게 정규화해야 함', () => {
                // Test various result formats
                const arrayResult = [{ id: 1 }];
                const normalized1 = table._normalizeResult(arrayResult);
                expect(normalized1).toBe(1);

                const numInsertedResult = { numInsertedRows: 1 };
                const normalized2 = table._normalizeResult(numInsertedResult);
                expect(normalized2).toBe(1);

                const affectedRowsResult = { affectedRows: 1 };
                const normalized3 = table._normalizeResult(affectedRowsResult);
                expect(normalized3).toBe(1);

                const changesResult = { changes: 1 };
                const normalized4 = table._normalizeResult(changesResult);
                expect(normalized4).toBe(1);

                const unknownResult = { someProperty: 'value' };
                const normalized5 = table._normalizeResult(unknownResult);
                expect(normalized5).toBe(0);
            });

            it("필수 필드가 누락된 경우 에러가 발생해야 한다", async () => {
                const invalidData = {
                    name: 'No Email User'
                    // email 필드 누락 (nullable: false)
                };

                await expect(table.insert(invalidData)).rejects.toThrow(/NOT NULL/);
                // expect(async () => await users.insert(invalidData)).toThrow();
            });

            it("unique 제약조건을 위반하는 경우 에러가 발생해야 한다", async () => {
                const duplicateEmailData = {
                    email: 'test@example.com', // 이미 존재하는 이메일
                    name: 'Duplicate Email User',
                    age: 28,
                };
                await table.insert(duplicateEmailData); // 첫 삽입은 성공해야 함

                await expect(table.insert(duplicateEmailData)).rejects.toThrow(/UNIQUE/);
            });

            it.skip("외래키 제약조건을 위반하는 경우 에러가 발생해야 한다", async () => {
                const invalidOrderData = {
                    user_id: 999, // 존재하지 않는 user_id
                    amount: 100.00
                };

                await expect(table.insert(invalidOrderData)).rejects.toThrow();
            });
        });

        describe('update() method tests', () => {
            let table;
            let conn;

            beforeEach(async () => {
                table = new SQLTable('test_person');
                conn = {
                    dialect: new SqliteDialect({
                        database: new Database(':memory:')
                    })
                };
                table.connect = conn;
                await table.init();

                // Setup columns
                table.columns.add('id', { primaryKey: true, autoIncrement: true, nullable: false });
                table.columns.add('name', { nullable: false });
                table.columns.add('age', { nullable: false });
                table.columns.add('email', { nullable: true });

                // Create table
                await table.db.schema
                    .createTable('test_person')
                    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
                    .addColumn('name', 'text', (col) => col.notNull())
                    .addColumn('age', 'integer', (col) => col.notNull())
                    .addColumn('email', 'text')
                    .execute();

                // Insert test data
                await table.db.insertInto('test_person')
                    .values([
                        { name: '홍길동', age: 30, email: 'hong@test.com' },
                        { name: '김로직', age: 40, email: 'kim@test.com' },
                        { name: '이순신', age: 50, email: 'lee@test.com' }
                    ])
                    .execute();
            });

            afterEach(async () => {
                await table.db.destroy();
            });

            it('객체 데이터로 단일 행을 업데이트해야 함', async () => {
                const updateData = {
                    id: 1,
                    name: '홍길동2',
                    age: 32,
                    email: 'hong2@test.com'
                };
                const options = {};

                const result = await table.update(updateData, options);

                expect(result).toBe(1);

                // Verify update
                const rows = await table.db
                    .selectFrom('test_person')
                    .where('id', '=', 1)
                    .selectAll()
                    .execute();
                expect(rows.length).toBe(1);
                expect(rows[0].name).toBe('홍길동2');
                expect(rows[0].age).toBe(32);
                expect(rows[0].email).toBe('hong2@test.com');
            });

            it('set과 where 조건을 명시적으로 분리하여 업데이트해야 함', async () => {
                const updateData = {
                    set: { name: '김로직2', age: 42 },
                    where: { id: 2 }
                };
                const options = {};

                const result = await table.update(updateData, options);

                expect(result).toBe(1);

                // Verify update
                const rows = await table.db
                    .selectFrom('test_person')
                    .where('id', '=', 2)
                    .selectAll()
                    .execute();
                expect(rows.length).toBe(1);
                expect(rows[0].name).toBe('김로직2');
                expect(rows[0].age).toBe(42);
                expect(rows[0].email).toBe('kim@test.com'); // Should remain unchanged
            });

            it('MetaRow 객체로 행을 업데이트해야 함', async () => {
                // Create a MetaRow-like object
                const metaRow = {
                    id: 3,
                    name: '이순신2',
                    age: 52,
                    email: 'lee2@test.com'
                };

                const options = {};
                const result = await table.update(metaRow, options);

                expect(result).toBe(1);

                // Verify update
                const rows = await table.db
                    .selectFrom('test_person')
                    .where('id', '=', 3)
                    .selectAll()
                    .execute();
                expect(rows.length).toBe(1);
                expect(rows[0].name).toBe('이순신2');
                expect(rows[0].age).toBe(52);
                expect(rows[0].email).toBe('lee2@test.com');
            });

            it('트랜잭션과 함께 업데이트해야 함', async () => {
                await table.db.transaction().execute(async (trx) => {
                    const updateData = { id: 1, name: '트랜잭션 테스트', age: 99 };
                    const options = { trx };

                    const result = await table.update(updateData, options);

                    expect(result).toBe(1);

                    // Verify update within transaction
                    const rows = await trx
                        .selectFrom('test_person')
                        .where('id', '=', 1)
                        .selectAll()
                        .execute();
                    expect(rows.length).toBe(1);
                    expect(rows[0].name).toBe('트랜잭션 테스트');
                    expect(rows[0].age).toBe(99);
                });
            });

            it('dryRun=true일 때 컴파일된 SQL을 반환해야 함', async () => {
                const updateData = { id: 1, name: '드라이런 테스트', age: 88 };
                const options = { dryRun: true };

                const result = await table.update(updateData, options);

                expect(result).toHaveProperty('sql');
                expect(result.sql).toContain('update');
                expect(result.sql).toContain('test_person');
                expect(result.sql).toContain('set');

                // Verify no actual update occurred
                const rows = await table.db
                    .selectFrom('test_person')
                    .where('id', '=', 1)
                    .selectAll()
                    .execute();
                expect(rows[0].name).toBe('홍길동'); // Should remain unchanged
                expect(rows[0].age).toBe(30); // Should remain unchanged
            });

            it('영향받은 행 수가 maxUpdateRows를 초과할 때 오류를 발생시켜야 함', async () => {
                // First, insert additional rows with same age to exceed limit
                await table.db.insertInto('test_person').values([
                    { name: '테스트1', age: 25, email: 'test1@test.com' },
                    { name: '테스트2', age: 25, email: 'test2@test.com' }
                ]).execute();

                const updateData = {
                    set: { email: 'bulk@test.com' },
                    where: { age: 25 } // This will update 2 rows
                };
                const options = { maxUpdateRows: 1 };

                await expect(table.update(updateData, options)).rejects.toThrow('affectedRows 2 exceeds limit 1');
            });

            it('업데이트 전후 이벤트를 발생시켜야 함', async () => {
                const updatingHandler = jest.fn();
                const updatedHandler = jest.fn();

                table.onUpdating(updatingHandler);
                table.onUpdated(updatedHandler);

                const updateData = { id: 1, name: '이벤트 테스트', age: 77 };
                const options = {};

                await table.update(updateData, options);

                expect(updatingHandler).toHaveBeenCalledWith({
                    table: table,
                    db: expect.any(Object),
                    options: expect.objectContaining({ trx: expect.any(Object) })
                });

                expect(updatedHandler).toHaveBeenCalledWith({
                    table: table,
                    db: expect.any(Object),
                    options: expect.objectContaining({})
                });
            });

            it('WHERE 조건이 없을 때 오류를 발생시켜야 함', async () => {
                const updateData = {
                    set: { name: '전체 업데이트' },
                    where: {}
                };
                const options = {};

                await expect(table.update(updateData, options)).rejects.toThrow();
            });

            it('존재하지 않는 컬럼은 필터링해야 함', async () => {
                const updateData = {
                    id: 2,
                    name: '필터링 테스트',
                    age: 66,
                    nonExistentColumn: 'should be filtered'
                };
                const options = {};

                const result = await table.update(updateData, options);

                expect(result).toBe(1);

                // Verify update (nonExistentColumn should be ignored)
                const rows = await table.db
                    .selectFrom('test_person')
                    .where('id', '=', 2)
                    .selectAll()
                    .execute();
                expect(rows.length).toBe(1);
                expect(rows[0].name).toBe('필터링 테스트');
                expect(rows[0].age).toBe(66);
                expect(rows[0]).not.toHaveProperty('nonExistentColumn');
            });

            it('null 값을 올바르게 처리해야 함', async () => {
                const updateData = { id: 3, email: null };
                const options = {};

                const result = await table.update(updateData, options);

                expect(result).toBe(1);

                // Verify update with null value
                const rows = await table.db
                    .selectFrom('test_person')
                    .where('id', '=', 3)
                    .selectAll()
                    .execute();
                expect(rows.length).toBe(1);
                expect(rows[0].email).toBeNull();
                expect(rows[0].name).toBe('이순신'); // Should remain unchanged
                expect(rows[0].age).toBe(50); // Should remain unchanged
            });

            it('updateBuilder 메서드가 올바른 빌더를 반환해야 함', async () => {
                const updateData = { id: 1, name: '빌더 테스트', age: 55 };
                const options = { trx: table.db };

                const builder = table.updateBuilder(updateData, options);

                expect(builder).toBeDefined();
                expect(typeof builder.execute).toBe('function');

                const compiled = builder.compile();
                expect(compiled.sql).toContain('update');
                expect(compiled.sql).toContain('test_person');
                expect(compiled.sql).toContain('set');
            });

            it('복합 WHERE 조건을 올바르게 처리해야 함', async () => {
                const updateData = {
                    set: { email: 'updated@test.com' },
                    where: { name: '김로직', age: 40 }
                };
                const options = {};

                const result = await table.update(updateData, options);

                expect(result).toBe(1);

                // Verify update
                const rows = await table.db
                    .selectFrom('test_person')
                    .where('name', '=', '김로직')
                    .selectAll()
                    .execute();
                expect(rows.length).toBe(1);
                expect(rows[0].email).toBe('updated@test.com');
            });

            it('$getColumns 메서드를 올바르게 사용해야 함', async () => {
                const updateData = {
                    id: 1,
                    name: '컬럼 테스트',
                    age: 44,
                    invalidColumn: 'test'
                };

                const setData = table.$getColumns(updateData, 'set');

                expect(setData).toHaveProperty('name', '컬럼 테스트');
                expect(setData).toHaveProperty('age', 44);
                expect(setData).not.toHaveProperty('id'); // PK should be excluded from set
                expect(setData).not.toHaveProperty('invalidColumn');

                const whereData = table.$getColumns(updateData, 'pk');
                expect(whereData).toHaveProperty('id', 1);
                expect(whereData).not.toHaveProperty('name');
                expect(whereData).not.toHaveProperty('age');
            });

            it('결과를 올바르게 정규화해야 함', () => {
                // Test various result formats
                const numUpdatedResult = { numUpdatedRows: 1 };
                const normalized1 = table._normalizeResult(numUpdatedResult);
                expect(normalized1).toBe(1);

                const affectedRowsResult = { affectedRows: 2 };
                const normalized2 = table._normalizeResult(affectedRowsResult);
                expect(normalized2).toBe(2);

                const changesResult = { changes: 1 };
                const normalized3 = table._normalizeResult(changesResult);
                expect(normalized3).toBe(1);

                const unknownResult = { someProperty: 'value' };
                const normalized4 = table._normalizeResult(unknownResult);
                expect(normalized4).toBe(0);
            });

            it('영향받은 행 수 제한을 올바르게 강제해야 함', () => {
                // Should not throw when within limit
                expect(() => table._enforceAffectLimit(1, 5)).not.toThrow();
                expect(() => table._enforceAffectLimit(5, 5)).not.toThrow();

                // Should throw when exceeding limit
                expect(() => table._enforceAffectLimit(6, 5)).toThrow('affectedRows 6 exceeds limit 5');

                // Should handle null/undefined limits
                expect(() => table._enforceAffectLimit(100, null)).not.toThrow();
                expect(() => table._enforceAffectLimit(100, undefined)).not.toThrow();
            });

            it('기본 옵션을 올바르게 처리해야 함', async () => {
                const updateData = { id: 1, name: '기본 옵션 테스트', age: 33 };
                const options = {
                    maxUpdateRows: 10 // Override default
                };

                const result = await table.update(updateData, options);

                expect(result).toBe(1);

                // Verify update
                const rows = await table.db
                    .selectFrom('test_person')
                    .where('id', '=', 1)
                    .selectAll()
                    .execute();
                expect(rows[0].name).toBe('기본 옵션 테스트');
                expect(rows[0].age).toBe(33);
            });

            it('여러 행을 한 번에 업데이트할 수 있어야 함', async () => {
                const updateData = {
                    set: { email: 'bulk@example.com' },
                    where: { age: ['>=', 30] } // Update rows where age >= 30
                    // where: { age: { '>=': 30 } } // Update rows where age >= 30
                };
                const options = { maxUpdateRows: 10 }; // Allow multiple updates

                const result = await table.update(updateData, options);

                expect(result).toBe(3); // All 3 rows have age >= 30

                // Verify all rows were updated
                const rows = await table.db.selectFrom('test_person').selectAll().execute();
                expect(rows.length).toBe(3);
                rows.forEach((row) => {
                    expect(row.email).toBe('bulk@example.com');
                });
            });
            
        });

        describe('select() method tests', () => {
            let table;
            let conn;

            beforeEach(async () => {
                table = new SQLTable('test_person');
                conn = {
                    dialect: new SqliteDialect({
                    database: new Database(':memory:')
                    })
                };
                table.connect = conn;
                await table.init();

                // Setup columns
                table.columns.add('id', { primaryKey: true, autoIncrement: true, nullable: false });
                table.columns.add('name', { nullable: false });
                table.columns.add('age', { nullable: false });
                table.columns.add('email', { nullable: true });
                table.columns.add('department', { nullable: true });

                // Create table
                await table.db.schema
                    .createTable('test_person')
                    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
                    .addColumn('name', 'text', (col) => col.notNull())
                    .addColumn('age', 'integer', (col) => col.notNull())
                    .addColumn('email', 'text')
                    .addColumn('department', 'text')
                    .execute();

                // Insert test data
                await table.db.insertInto('test_person')
                    .values([
                    { name: '홍길동', age: 30, email: 'hong@test.com', department: 'IT' },
                    { name: '김로직', age: 40, email: 'kim@test.com', department: 'HR' },
                    { name: '이순신', age: 50, email: 'lee@test.com', department: 'IT' },
                    { name: '강감찬', age: 35, email: 'kang@test.com', department: 'Finance' },
                    { name: '세종대왕', age: 45, email: 'sejong@test.com', department: 'IT' },
                    { name: '정약용', age: 55, email: 'jung@test.com', department: 'HR' },
                    { name: '신사임당', age: 48, email: 'shin@test.com', department: 'Finance' }
                    ])
                    .execute();
            });

            afterEach(async () => {
                await table.db.destroy();
            });

            it('기본 선택 조건으로 모든 행을 조회해야 함', async () => {
                const selectOpt = { page: 1, size: 10 };
                const options = {};

                const result = await table.select(selectOpt, options);

                expect(result.length).toBe(7);
                expect(result[0]).toHaveProperty('id');
                expect(result[0]).toHaveProperty('name');
                expect(result[0]).toHaveProperty('age');
                expect(result[0]).toHaveProperty('email');
                expect(result[0]).toHaveProperty('department');
            });

            it('페이지네이션을 올바르게 처리해야 함', async () => {
                const selectOpt1 = { page: 1, size: 3 };
                const result1 = await table.select(selectOpt1, {});

                expect(result1.length).toBe(3);

                const selectOpt2 = { page: 2, size: 3 };
                const result2 = await table.select(selectOpt2, {});

                expect(result2.length).toBe(3);

                const selectOpt3 = { page: 3, size: 3 };
                const result3 = await table.select(selectOpt3, {});

                expect(result3.length).toBe(1); // Last page with remaining row
            });

            it('WHERE 조건으로 특정 행을 조회해야 함', async () => {
                const selectOpt = {
                    page: 1,
                    size: 10,
                    where: { department: 'IT' }
                };
                const options = {};

                const result = await table.select(selectOpt, options);

                expect(result.length).toBe(3);
                result.forEach(row => {
                    expect(row.department).toBe('IT');
                });
            });

            it('복합 WHERE 조건을 올바르게 처리해야 함', async () => {
                const selectOpt = {
                    page: 1,
                    size: 10,
                    where: { department: 'IT', age: 30 }
                };
                const options = {};

                const result = await table.select(selectOpt, options);

                expect(result.length).toBe(1);
                expect(result[0].name).toBe('홍길동');
                expect(result[0].department).toBe('IT');
                expect(result[0].age).toBe(30);
            });

            it('특정 컬럼만 선택해야 함', async () => {
                const selectOpt = {
                    page: 1,
                    size: 10,
                    select: ['name', 'age']
                };
                const options = {};

                const result = await table.select(selectOpt, options);

                expect(result.length).toBe(7);
                expect(result[0]).toHaveProperty('name');
                expect(result[0]).toHaveProperty('age');
                expect(result[0]).not.toHaveProperty('email');
                expect(result[0]).not.toHaveProperty('department');
            });

            it('ORDER BY를 올바르게 처리해야 함', async () => {
                const selectOpt = {
                    page: 1,
                    size: 10,
                    orderBy: { age: 'asc' }
                };
                const options = {};

                const result = await table.select(selectOpt, options);

                expect(result.length).toBe(7);
                expect(result[0].age).toBeLessThanOrEqual(result[1].age);
                expect(result[1].age).toBeLessThanOrEqual(result[2].age);
                expect(result[0].name).toBe('홍길동'); // age 30, youngest
            });

            it('DESC ORDER BY를 올바르게 처리해야 함', async () => {
                const selectOpt = {
                    page: 1,
                    size: 10,
                    orderBy: { age: 'desc' }
                };
                const options = {};

                const result = await table.select(selectOpt, options);

                expect(result.length).toBe(7);
                expect(result[0].age).toBeGreaterThanOrEqual(result[1].age);
                expect(result[1].age).toBeGreaterThanOrEqual(result[2].age);
                expect(result[0].name).toBe('정약용'); // age 55, oldest
            });

            it('GROUP BY를 올바르게 처리해야 함', async () => {
                const selectOpt = {
                    page: 1,
                    size: 10,
                    select: ['department'],
                    groupBy: ['department']
                };
                const options = {};

                const result = await table.select(selectOpt, options);

                expect(result.length).toBe(3); // IT, HR, Finance
                const departments = result.map(row => row.department).sort();
                expect(departments).toEqual(['Finance', 'HR', 'IT']);
            });

            it('HAVING 조건을 올바르게 처리해야 함', async () => {
                // Insert additional test data to make HAVING meaningful
                await table.db.insertInto('test_person')
                    .values([
                    { name: '추가1', age: 25, email: 'add1@test.com', department: 'IT' },
                    { name: '추가2', age: 26, email: 'add2@test.com', department: 'IT' }
                    ])
                    .execute();

                const selectOpt = {
                    page: 1,
                    size: 10,
                    select: ['department'],
                    groupBy: ['department'],
                    having: [{ col: 'department', op: '=', val: 'IT' }]
                };
                const options = {};

                const result = await table.select(selectOpt, options);

                expect(result.length).toBe(1);
                expect(result[0].department).toBe('IT');
            });

            it('트랜잭션과 함께 조회해야 함', async () => {
            await table.db.transaction().execute(async (trx) => {
                const selectOpt = { page: 1, size: 5 };
                const options = { trx };

                const result = await table.select(selectOpt, options);

                expect(result.length).toBe(5);
                expect(result[0]).toHaveProperty('name');
            });
            });

            it('dryRun=true일 때 컴파일된 SQL을 반환해야 함', async () => {
                const selectOpt = {
                    page: 1,
                    size: 10,
                    where: { age: 30 }
                };
                const options = { dryRun: true };

                const result = await table.select(selectOpt, options);

                expect(result).toHaveProperty('sql');
                expect(result.sql).toContain('select');
                expect(result.sql).toContain('from');
                expect(result.sql).toContain('test_person');
                expect(result.sql).toContain('where');
            });

            it('maxSelectRows 제한을 올바르게 처리해야 함', async () => {
                const selectOpt = { page: 1, size: 10 };
                const options = { maxSelectRows: 3 };

                await expect(table.select(selectOpt, options)).rejects.toThrow(
                    'affectedRows 7 exceeds limit 3'
                );
            });

            it('fillRows=true일 때 테이블 rows에 데이터를 추가해야 함', async () => {
                const initialRowCount = table.rows.count;
                
                const selectOpt = { page: 1, size: 3 };
                const options = { fillRows: true };

                const result = await table.select(selectOpt, options);

                expect(result.length).toBe(3);
                expect(table.rows.count).toBe(initialRowCount + 3);
                expect(table.getChanges().length).toBe(3); // New rows should be tracked as changes
            });

            it('조회 전후 이벤트를 발생시켜야 함', async () => {
                const selectingHandler = jest.fn();
                const selectedHandler = jest.fn();

                table.onSelecting(selectingHandler);
                table.onSelected(selectedHandler);

                const selectOpt = { page: 1, size: 5 };
                const options = {};

                await table.select(selectOpt, options);

                expect(selectingHandler).toHaveBeenCalledWith({
                    table: table,
                    db: expect.any(Object),
                    options: expect.objectContaining({ trx: expect.any(Object) })
                });

                expect(selectedHandler).toHaveBeenCalledWith({
                    table: table,
                    db: expect.any(Object),
                    options: expect.objectContaining({})
                });
            });

            it('DISTINCT 옵션을 올바르게 처리해야 함', async () => {
                const selectOpt = {
                    page: 1,
                    size: 10,
                    select: ['department'],
                    distinct: true
                };
                const options = {};

                const result = await table.select(selectOpt, options);

                expect(result.length).toBe(3); // IT, HR, Finance
                const uniqueDepartments = [...new Set(result.map(row => row.department))];
                expect(uniqueDepartments.length).toBe(3);
            });

            it('selectBuilder 메서드가 올바른 빌더를 반환해야 함', async () => {
                const selectOpt = {
                    page: 1,
                    size: 5,
                    where: { department: 'IT' },
                    orderBy: { age: 'asc' }
                };
                const options = { trx: table.db };

                const builder = table.selectBuilder(selectOpt, options);

                expect(builder).toBeDefined();
                expect(typeof builder.execute).toBe('function');

                const compiled = builder.compile();
                expect(compiled.sql).toContain('select');
                expect(compiled.sql).toContain('from');
                expect(compiled.sql).toContain('test_person');
            });

            it('빈 WHERE 조건을 올바르게 처리해야 함', async () => {
                const selectOpt = {
                    page: 1,
                    size: 10,
                    where: {}
                };
                const options = {};

                const result = await table.select(selectOpt, options);

                expect(result.length).toBe(7); // All rows should be returned
            });

            it('존재하지 않는 컬럼은 WHERE에서 무시해야 함', async () => {
                const selectOpt = {
                    page: 1,
                    size: 10,
                    where: {
                    department: 'IT',
                    nonExistentColumn: 'test'
                    }
                };
                const options = {};

                const result = await table.select(selectOpt, options);

                expect(result.length).toBe(3); // Only department filter should apply
                result.forEach(row => {
                    expect(row.department).toBe('IT');
                });
            });

            it('LIMIT과 OFFSET을 올바르게 계산해야 함', async () => {
                const selectOpt1 = { page: 1, size: 2 }; // LIMIT 2 OFFSET 0
                const result1 = await table.select(selectOpt1, {});
                expect(result1.length).toBe(2);

                const selectOpt2 = { page: 3, size: 2 }; // LIMIT 2 OFFSET 4
                const result2 = await table.select(selectOpt2, {});
                expect(result2.length).toBe(2);

                const selectOpt3 = { page: 4, size: 2 }; // LIMIT 2 OFFSET 6
                const result3 = await table.select(selectOpt3, {});
                expect(result3.length).toBe(1); // Only 1 row remaining
            });

            it('size가 0일 때 기본값 10을 사용해야 함', async () => {
                const selectOpt = { page: 1, size: 0 };
                const options = {};

                const result = await table.select(selectOpt, options);

                expect(result.length).toBe(7); // All 7 rows (less than default 10)
            });

            it('page가 1보다 작을 때 OFFSET 0을 사용해야 함', async () => {
                const selectOpt = { page: 0, size: 3 };
                const options = {};

                const result = await table.select(selectOpt, options);

                expect(result.length).toBe(3); // First 3 rows
            });

            it('복합 ORDER BY를 올바르게 처리해야 함', async () => {
                const selectOpt = {
                    page: 1,
                    size: 10,
                    orderBy: { department: 'asc', age: 'desc' }
                };
                const options = {};

                const result = await table.select(selectOpt, options);

                expect(result.length).toBe(7);
                
                // Check that Finance comes first, then HR, then IT
                const financeRows = result.filter(row => row.department === 'Finance');
                const hrRows = result.filter(row => row.department === 'HR');
                const itRows = result.filter(row => row.department === 'IT');
                
                expect(financeRows.length).toBeGreaterThan(0);
                expect(hrRows.length).toBeGreaterThan(0);
                expect(itRows.length).toBeGreaterThan(0);
            });

            it('MSSQL에서 OFFSET 사용 시 ORDER BY가 자동으로 추가되어야 함', async () => {
                // Mock MSSQL vendor
                table.profile.vendor = 'mssql';

                const selectOpt = {
                    page: 2,
                    size: 3
                    // No orderBy specified
                };
                const options = { trx: table.db };

                const builder = table.selectBuilder(selectOpt, options);
                const compiled = builder.compile();

                expect(compiled.sql).toContain('order by');
            });

            it('$getColumns 메서드를 올바르게 사용해야 함', async () => {
                const selectData = ['name', 'age', 'invalidColumn'];

                const processedData = table.$getColumns(selectData, 'data');

                expect(processedData).toHaveProperty('name');
                expect(processedData).toHaveProperty('age');
                expect(processedData).not.toHaveProperty('invalidColumn');
            });

            it('결과를 올바르게 정규화해야 함', () => {
                // Test array result (most common for SELECT)
                const arrayResult = [
                    { id: 1, name: '홍길동' },
                    { id: 2, name: '김로직' }
                ];
                const normalized1 = table._normalizeResult(arrayResult);
                expect(normalized1).toBe(2);

                // Test empty array
                const emptyResult = [];
                const normalized2 = table._normalizeResult(emptyResult);
                expect(normalized2).toBe(0);
            });

            it('빈 SELECT 배열일 때 모든 컬럼을 선택해야 함', async () => {
                const selectOpt = {
                    page: 1,
                    size: 1,
                    select: []
                };
                const options = {};

                const result = await table.select(selectOpt, options);

                expect(result.length).toBe(1);
                expect(result[0]).toHaveProperty('id');
                expect(result[0]).toHaveProperty('name');
                expect(result[0]).toHaveProperty('age');
                expect(result[0]).toHaveProperty('email');
                expect(result[0]).toHaveProperty('department');
            });

            it('오류 발생 시 적절한 예외를 던져야 함', async () => {
                // Mock an error by providing invalid table reference
                const originalTableName = table.tableName;
                table._name = 'non_existent_table';

                const selectOpt = { page: 1, size: 10 };
                const options = {};

                await expect(table.select(selectOpt, options)).rejects.toThrow();

                // Restore original table name
                table._name = originalTableName;
            });
            it('WHERE 조건에서 비교 연산자를 올바르게 처리해야 함', async () => {
                // Greater than or equal
                const selectOpt1 = {
                    page: 1,
                    size: 10,
                    where: { age: { '>=': 40 } }
                };
                const result1 = await table.select(selectOpt1, {});
                expect(result1.length).toBe(5); // ages: 40, 50, 45, 55, 48
                result1.forEach(row => {
                    expect(row.age).toBeGreaterThanOrEqual(40);
                });

                // Greater than
                const selectOpt2 = {
                    page: 1,
                    size: 10,
                    where: { age: { '>': 45 } }
                };
                const result2 = await table.select(selectOpt2, {});
                expect(result2.length).toBe(3); // ages: 50, 55, 48
                result2.forEach(row => {
                    expect(row.age).toBeGreaterThan(45);
                });

                // Less than
                const selectOpt3 = {
                    page: 1,
                    size: 10,
                    where: { age: { '<': 40 } }
                };
                const result3 = await table.select(selectOpt3, {});
                expect(result3.length).toBe(2); // ages: 30, 35
                result3.forEach(row => {
                    expect(row.age).toBeLessThan(40);
                });

                // Less than or equal
                const selectOpt4 = {
                    page: 1,
                    size: 10,
                    where: { age: { '<=': 35 } }
                };
                const result4 = await table.select(selectOpt4, {});
                expect(result4.length).toBe(2); // ages: 30, 35
                result4.forEach(row => {
                    expect(row.age).toBeLessThanOrEqual(35);
                });
            });

            it('WHERE 조건에서 IN 연산자를 올바르게 처리해야 함', async () => {
                const selectOpt = {
                    page: 1,
                    size: 10,
                    where: { 
                        department: { 'in': ['IT', 'HR'] }
                    }
                };
                const result = await table.select(selectOpt, {});
                
                expect(result.length).toBe(5); // 3 IT + 2 HR
                result.forEach(row => {
                    expect(['IT', 'HR']).toContain(row.department);
                });

                // Test with age values
                const selectOpt2 = {
                    page: 1,
                    size: 10,
                    where: { 
                        age: { 'in': [30, 40, 50] }
                    }
                };
                const result2 = await table.select(selectOpt2, {});
                
                expect(result2.length).toBe(3); // ages: 30, 40, 50
                result2.forEach(row => {
                    expect([30, 40, 50]).toContain(row.age);
                });
            });

            it('WHERE 조건에서 NOT IN 연산자를 올바르게 처리해야 함', async () => {
                const selectOpt = {
                    page: 1,
                    size: 10,
                    where: { 
                        department: { 'not in': ['Finance'] }
                    }
                };
                const result = await table.select(selectOpt, {});
                
                expect(result.length).toBe(5); // All except Finance (2)
                result.forEach(row => {
                    expect(row.department).not.toBe('Finance');
                });
            });

            it('WHERE 조건에서 BETWEEN 연산자를 올바르게 처리해야 함', async () => {
                const selectOpt = {
                    page: 1,
                    size: 10,
                    where: { 
                        age: { 'between': [35, 50] }
                    }
                };
                const result = await table.select(selectOpt, {});
                
                expect(result.length).toBe(5); // ages: 35, 40, 45, 48, 50
                result.forEach(row => {
                    expect(row.age).toBeGreaterThanOrEqual(35);
                    expect(row.age).toBeLessThanOrEqual(50);
                });
            });

            it('WHERE 조건에서 NOT BETWEEN 연산자를 올바르게 처리해야 함', async () => {
                const selectOpt = {
                    page: 1,
                    size: 10,
                    where: { 
                        age: { 'not between': [35, 50] }
                    }
                };
                const result = await table.select(selectOpt, {});
                
                expect(result.length).toBe(2); // ages: 30, 55
                result.forEach(row => {
                    expect(row.age < 35 || row.age > 50).toBe(true);
                });
            });

            it('WHERE 조건에서 LIKE 연산자를 올바르게 처리해야 함', async () => {
                const selectOpt1 = {
                    page: 1,
                    size: 10,
                    where: { 
                        name: { 'like': '%길%' }
                    }
                };
                const result1 = await table.select(selectOpt1, {});
                
                expect(result1.length).toBe(1); // 홍길동
                expect(result1[0].name).toBe('홍길동');

                // Test email domain
                const selectOpt2 = {
                    page: 1,
                    size: 10,
                    where: { 
                        email: { 'like': '%@test.com' }
                    }
                };
                const result2 = await table.select(selectOpt2, {});
                
                expect(result2.length).toBe(7); // All emails end with @test.com
                result2.forEach(row => {
                    expect(row.email).toMatch(/@test\.com$/);
                });
            });

            it('WHERE 조건에서 복합 연산자를 올바르게 처리해야 함', async () => {
                const selectOpt = {
                    page: 1,
                    size: 10,
                    where: { 
                        age: { '>=': 40 },
                        department: { 'in': ['IT', 'HR'] },
                        name: { 'like': '%' }
                    }
                };
                const result = await table.select(selectOpt, {});
                
                expect(result.length).toBe(4); // IT: 이순신(50), 세종대왕(45) + HR: 김로직(40), 정약용(55)
                result.forEach(row => {
                    expect(row.age).toBeGreaterThanOrEqual(40);
                    expect(['IT', 'HR']).toContain(row.department);
                });
            });

            it('WHERE 조건에서 IS NULL과 IS NOT NULL을 올바르게 처리해야 함', async () => {
                // First, insert a row with null email
                await table.db.insertInto('test_person')
                    .values({ name: '테스트', age: 25, email: null, department: 'Test' })
                    .execute();

                // Test IS NULL
                const selectOpt1 = {
                    page: 1,
                    size: 10,
                    where: { 
                        email: { 'is': null }
                    }
                };
                const result1 = await table.select(selectOpt1, {});
                
                expect(result1.length).toBe(1);
                expect(result1[0].email).toBeNull();

                // Test IS NOT NULL
                const selectOpt2 = {
                    page: 1,
                    size: 10,
                    where: { 
                        email: { 'is not': null }
                    }
                };
                const result2 = await table.select(selectOpt2, {});
                
                expect(result2.length).toBe(7); // All original rows have non-null emails
                result2.forEach(row => {
                    expect(row.email).not.toBeNull();
                });
            });

            it('WHERE 조건에서 NOT EQUAL 연산자를 올바르게 처리해야 함', async () => {
                const selectOpt = {
                    page: 1,
                    size: 10,
                    where: { 
                        department: { '!=': 'IT' }
                    }
                };
                const result = await table.select(selectOpt, {});
                
                expect(result.length).toBe(4); // All except IT (3)
                result.forEach(row => {
                    expect(row.department).not.toBe('IT');
                });

                // Alternative syntax
                const selectOpt2 = {
                    page: 1,
                    size: 10,
                    where: { 
                        department: { '<>': 'HR' }
                    }
                };
                const result2 = await table.select(selectOpt2, {});
                
                expect(result2.length).toBe(5); // All except HR (2)
                result2.forEach(row => {
                    expect(row.department).not.toBe('HR');
                });
            });
        });
    });
});

