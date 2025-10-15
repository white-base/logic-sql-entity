import { jest } from '@jest/globals';
import { createTestDB } from './db.js'

import { SQLTable } from '../src/sql-table.js';

import { SqliteDialect } from 'kysely'
import Database from 'better-sqlite3'

import { MysqlDialect } from 'kysely'
import mysql from 'mysql2'

//==============================================================
// test
let db;

describe("[target: sql-table.js]", () => {
    describe("SQLTable :: 클래스", () => {
        beforeEach(() => {
            jest.resetModules();
            // MetaRegistry.init();
        });
        describe("<테이블 등록후 속성 검사>", () => {
            it("- 테이블 등록후 속성 검사 ", () => {
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
        beforeAll( async () => {
            db = createTestDB()
    
            // 스키마 생성
            await db.schema
                .createTable('person')
                .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
                .addColumn('name', 'text', (col) => col.notNull())
                .addColumn('age', 'integer', (col) => col.notNull())
                .execute()
        })
    
        afterAll(async () => {
            await db.destroy()
        })
    
        it('INSERT & SELECT', async () => {
            await db
                .insertInto('person')
                .values({ name: '홍길동', age: 30 }).execute()
    
            const rows = await db.selectFrom('person').selectAll().execute()
            expect(rows.length).toBe(1)
            expect(rows[0].name).toBe('홍길동')
            expect(rows[0].age).toBe(30)
        })
    
        it('UPDATE', async () => {
            await db
                .updateTable('person')
                .set({ age: 31 })
                .where('name', '=', '홍길동')
                .execute()
    
            const row = await db
                .selectFrom('person')
                .select(['name', 'age'])
                .where('name', '=', '홍길동')
                .executeTakeFirst()
    
            expect(row?.age).toBe(31)
        })
    
        it('DELETE', async () => {
            await db.deleteFrom('person').where('name', '=', '홍길동').execute()
    
            const rows = await db.selectFrom('person').selectAll().execute()
            expect(rows.length).toBe(0)
        })
    
        it('insert SQLTable', async () => {
            const table = new SQLTable('person');
            const conn = {
                dialect: new SqliteDialect({
                    // database: new Database(':memory:')
                    database: new Database('sql-table-test.sqlite')
                })
            };
            table.connect = conn;
    
            table.columns.add('id', {primaryKey: true});
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
                .execute()
    
            // table.connect = {
            //     driver: 'sqlite3',
            //     database: ':memory:',
            //     // connection: 'Server=.;Database=app;User Id=sa;Password=***;'
            // };
    
            await table.insert({ name: '홍길동', age: 30 });
            await table.insert({ name: '김로직', age: 40 });
            await table.update({ id: 1, name: '홍길동2', age: 32 });
            await table.delete({ id: 2 });
    
            table.rows.add({ name: '이순신', age: 50 });
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
    
        })
        it('sqlite3 SQLTable', async () => {
            const table = new SQLTable('person');
            const conn = {
                dialect: new SqliteDialect({
                    database: new Database(':memory:')
                })
            };
            table.connect = conn;

            table.columns.add('id', { primaryKey: true, autoIncrement: true, nullable: false });
            table.columns.add('name', { nullable: false });
            table.columns.add('age', { nullable: false });

            // 스키마 생성
            await table.db.schema
                .createTable('person')
                .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
                .addColumn('name', 'text', (col) => col.notNull())
                .addColumn('age', 'integer', (col) => col.notNull())
                .execute()
    
            table.connect = {
                driver: 'sqlite3',
                database: ':memory:',
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
    
            const rows3 = await table.select(1, 10);
    
            expect(rows3.length).toBe(3);
            expect(table.getChanges().length).toBe(3);
            expect(table.rows.count).toBe(6);
    
        });
    
        it('getCreateDDL', async () => {
            const table = new SQLTable('person');
            const conn = {
                dialect: new SqliteDialect({
                    database: new Database(':memory:')
                })
            };
            table.connect = conn;
            table.columns.add('id', { dataType: 'int', primaryKey: true, autoIncrement: true, nullable: false});
            table.columns.add('email', { dataType: 'varchar(255)', unique: true, nullable: false, indexes: 'em' });
            table.columns.add('updated_at', { dataType: 'timestamp', nullable: true, defaultValue: { kind: 'now' }, onUpdateValue: { kind: 'now' } });
    
            const sql = await table.getCreateSQL();

            expect(sql.length).toBe(2);
            expect(sql[0].sql).toBe(`create table \"person\" (\"id\" integer not null primary key autoincrement, \"email\" text not null unique, \"updated_at\" numeric default CURRENT_TIMESTAMP)`);
            expect(sql[1].sql).toBe(`create index "idx_person_em_email" on "person" ("email")`);

            const dropSql = await table.getDropSQL();
            expect(dropSql.sql).toBe(`drop table if exists "person"`);
        });
    
        // REVIEW: docker로 mysql 서버 띄워서 테스트 해야함
        it.skip('insert SQLTable3 mysql', async () => {
            const table = new SQLTable('person');
            const conn = {
                dialect: new MysqlDialect({
                    pool: mysql.createPool({
                        host: 'localhost',       // MySQL 서버 주소
                        port: 3306,               // 포트 (기본값 3306)
                        user: 'testuser',             // 사용자명
                        password: 'testpw',     // 비밀번호
                        database: 'testdb',      // 사용할 데이터베이스명
                        connectionLimit: 10       // 커넥션 풀 최대 개수
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
                .execute()
    
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
        })
    });
});

