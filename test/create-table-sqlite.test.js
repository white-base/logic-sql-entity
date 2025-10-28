import { expect, jest }     from '@jest/globals';
import {MetaRegistry} from 'logic-entity';

import { SqliteDialect, sql } from 'kysely'
import Database from 'better-sqlite3'
import { SQLTable } from '../src/sql-table.js';
import { convertStandardToVendor } from '../src/util/convert-data-type.js'; // 추가

/**
 * 권장: SQLite 3.x (최신 안정판)
 */

describe("[target: create-table-test.js]", () => {
    let users, orders;
    // let dbFile = 'mydb-test.sqlite';
    let dbFile = ':memory:';

    beforeAll(async () => {
        // jest.resetModules();
        MetaRegistry.init();

        users = new SQLTable('users');
        users.connect = {
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
        await users.init();

        users.columns.add('id',    { dataType: 'int', primaryKey: true, autoIncrement: true, nullable: false });
        users.columns.add('email', { dataType: 'varchar(255)', unique: true, nullable: false });
        users.columns.add('name',  { dataType: 'varchar(100)', nullable: false });
        users.columns.add('created_at', { dataType: 'timestamp', nullable: false, defaultValue: { kind: 'now' } });
        
        users.columns.add('bigint_col',      { dataType: 'bigint' });
        users.columns.add('numeric_col',     { dataType: 'numeric(18,2)' });
        
        users.columns.add('double_col',      { dataType: 'double' });
        users.columns.add('boolean_col',     { dataType: 'boolean' });
        
        users.columns.add('text_col',        { dataType: 'text' });
        users.columns.add('char_col',        { dataType: 'char(10)' });

        users.columns.add('date_col',        { dataType: 'date' });
        users.columns.add('time_col',        { dataType: 'time' });
        users.columns.add('timestamp_col',   { dataType: 'timestamp' });
        
        users.columns.add('json_col',        { dataType: 'json' });
        users.columns.add('uuid_col',        { dataType: 'uuid' });
        users.columns.add('bytes_col',        { dataType: 'bytes' });
        
        users.columns.add('blob_col',        { dataType: 'blob', vendor: { sqlite: { dataType: 'blob' } } });

        orders = new SQLTable('orders');
        orders.connect = users.connect;
        await orders.init();

        orders.columns.add('id',       { dataType: 'int', primaryKey: true, autoIncrement: true, nullable: false });
        orders.columns.add('user_id',  { dataType: 'int', nullable: false,
            references: { target: 'users.id', group: 'fk_user', onDelete: 'CASCADE', onUpdate: 'CASCADE' },
            indexes: ['ix_user'] });
        orders.columns.add('amount',   { dataType: 'numeric(12,2)', nullable: false, indexes: ['ix_amount_created'] });
        orders.columns.add('created_at',{ dataType: 'timestamp',    nullable: false, defaultValue: { kind: 'now' }, indexes: ['ix_amount_created'] });

        const db = users.db;
        await sql`PRAGMA foreign_keys = ON`.execute(db);    // FK 제약조건 설정
        await sql`PRAGMA journal_mode = WAL`.execute(db);   // 동시성 및 복구력 향상
        await sql`PRAGMA synchronous = NORMAL`.execute(db); // 성능 향상


        // 기존에 테이블이 있으면 삭제
        
        // await sql`DROP TABLE IF EXISTS orders`.execute(db);
        // await sql`DROP TABLE IF EXISTS users`.execute(db);
        await orders.drop();
        await users.drop();

        await users.create();
        await orders.create();
    });

    afterAll(async () => {
        await orders.db.destroy()
        await users.db.destroy()
        MetaRegistry.init();
    })

    describe("테이블 생성 및 구조 확인", () => {
        it("users 테이블이 생성되어야 한다", async () => {
            const db = users.db;
            const result = await sql`SELECT name FROM sqlite_master WHERE type='table' AND name='users'`.execute(db);
            const row = result.rows[0];
            expect(row).toBeDefined();
            expect(row.name).toBe('users');
        });

        it("orders 테이블이 생성되어야 한다", async () => {
            const db = orders.db;
            const result = await sql`SELECT name FROM sqlite_master WHERE type='table' AND name='orders'`.execute(db);
            const row = result.rows[0];
            expect(row).toBeDefined();
            expect(row.name).toBe('orders');
        });

        it("users 테이블에 email 컬럼이 있어야 한다", async () => {
            const db = users.db;
            const { rows: columns } = await sql`PRAGMA table_info(users)`.execute(db);
            const emailCol = columns.find(col => col.name === 'email');
            expect(emailCol).toBeDefined();
            expect(emailCol.notnull).toBe(1);
        });

        it("orders 테이블에 user_id FK가 있어야 한다", async () => {
            const db = orders.db;
            const { rows: fks } = await sql`PRAGMA foreign_key_list(orders)`.execute(db);
            expect(fks.some(fk => fk.table === 'users' && fk.from === 'user_id')).toBe(true);
        });

        it("orders 테이블에 인덱스가 생성되어야 한다", async () => {
            const db = orders.db;
            const { rows: indexes } = await sql`PRAGMA index_list(orders)`.execute(db);
            const indexNames = indexes.map(idx => idx.name);

            // ix_user, ix_amount_created 인덱스가 존재해야 함
            expect(indexNames.some(name => name.includes('ix_user'))).toBe(true);
            expect(indexNames.some(name => name.includes('ix_amount_created'))).toBe(true);

            // 인덱스 컬럼 확인
            const getIndexColumns = async (indexName) => {
                const { rows } = await sql`PRAGMA index_info(${sql.raw(indexName)})`.execute(db);
                return rows.map(r => r.name);
            };

            // ix_user는 user_id 컬럼을 포함해야 함
            const ixUser = indexNames.find(name => name.includes('ix_user'));
            if (ixUser) {
                const cols = await getIndexColumns(ixUser);
                expect(cols).toContain('user_id');
            }

            // ix_amount_created는 amount, created_at 컬럼을 포함해야 함
            const ixAmountCreated = indexNames.find(name => name.includes('ix_amount_created'));
            if (ixAmountCreated) {
                const cols = await getIndexColumns(ixAmountCreated);
                expect(cols).toEqual(expect.arrayContaining(['amount', 'created_at']));
            }
        });
    });
    describe("컬럼 자료형 및 제약조건 확인", () => {

        it("users 테이블의 컬럼 자료형이 올바르게 생성되어야 한다", async () => {
            const db = users.db;
            const { rows: columns } = await sql`PRAGMA table_info(users)`.execute(db);

            // 표준 타입 → sqlite 타입 변환 후 비교
            const expectType = (colName, stdType, vendorTypeExpected) => {
                const col = columns.find(c => c.name === colName);
                expect(col).toBeDefined();
                const vendorType = convertStandardToVendor(stdType, 'sqlite');
                // expect(col.type.toUpperCase()).toBe(vendorType);
                expect(col.type.toUpperCase()).toBe(vendorTypeExpected);
            };

            expectType('id', 'int', 'INTEGER');
            expectType('email', 'varchar(255)', 'TEXT');
            expectType('name', 'varchar(100)', 'TEXT');
            expectType('created_at', 'timestamp', 'NUMERIC');
            expectType('bigint_col', 'bigint', 'INTEGER');
            // expectType('real_col', 'real', 'TEXT');
            expectType('double_col', 'double', 'REAL');
            expectType('boolean_col', 'boolean', 'INTEGER');

            expectType('text_col', 'text', 'TEXT');
            expectType('char_col', 'char(10)', 'TEXT');

            expectType('date_col', 'date', 'NUMERIC');
            expectType('time_col', 'time', 'NUMERIC');
            expectType('timestamp_col', 'timestamp', 'NUMERIC');
            
            expectType('json_col', 'json', 'TEXT');
            expectType('uuid_col', 'uuid', 'TEXT');
            expectType('bytes_col', 'bytes', 'BLOB');

            expectType('blob_col', 'blob', 'BLOB');
        });

        it("orders 테이블의 컬럼 자료형이 올바르게 생성되어야 한다", async () => {
            const db = orders.db;
            const { rows: columns } = await sql`PRAGMA table_info(orders)`.execute(db);

            const expectType = (colName, stdType, vendorTypeExpected) => {
                const col = columns.find(c => c.name === colName);
                expect(col).toBeDefined();
                const vendorType = convertStandardToVendor(stdType, 'sqlite');
                expect(col.type.toUpperCase()).toBe(vendorType);
                expect(col.type.toUpperCase()).toBe(vendorTypeExpected);
            };

            expectType('id', 'int', 'INTEGER');
            expectType('user_id', 'int', 'INTEGER');
            expectType('amount', 'numeric(12,2)', 'NUMERIC');
            expectType('created_at', 'timestamp', 'NUMERIC');
        });
    });
        
    
    describe.skip("데이터 삽입 테스트", () => {
        it("users 테이블에 데이터를 삽입할 수 있어야 한다", async () => {
            const userData = {
                email: 'test@example.com',
                name: 'Test User',
                bigint_col: 123456789,
                numeric_col: 99.99,
                double_col: 3.14159,
                boolean_col: 1,
                // text_col: 'Sample text',
                // char_col: 'CHAR10',
                // date_col: new Date('2023-01-01'),
                // time_col: '14:30:00',
                // timestamp_col: new Date(),
                // json_col: { key: 'value' },
                // uuid_col: '550e8400-e29b-41d4-a716-446655440000',
                // bytes_col: Buffer.from('binary data'),
                // blob_col: Buffer.from('blob data')
            };

            const result = await users.insert(userData);
            expect(result).toBeDefined();
            // expect(result.insertId).toBeDefined();
        });

        it.skip("orders 테이블에 데이터를 삽입할 수 있어야 한다", async () => {
            const orderData = {
                user_id: 1,
                amount: 299.99
            };

            const result = await orders.insert(orderData);
            expect(result).toBeDefined();
            // expect(result.insertId).toBeDefined();
        });

        it("여러 레코드를 한 번에 삽입할 수 있어야 한다", async () => {
            const usersData = [
                { email: 'user1@example.com', name: 'User One' },
                { email: 'user2@example.com', name: 'User Two' },
                { email: 'user3@example.com', name: 'User Three' }
            ];

            const result = await users.insert(usersData);
            expect(result).toBeDefined();
            expect(result.length).toBe(3);
        });

        it("필수 필드가 누락된 경우 에러가 발생해야 한다", async () => {
            const invalidData = {
                name: 'No Email User'
                // email 필드 누락 (nullable: false)
            };

            await expect(users.insert(invalidData)).rejects.toThrow();
            // expect(async () => await users.insert(invalidData)).toThrow();
        });

        it("unique 제약조건을 위반하는 경우 에러가 발생해야 한다", async () => {
            const duplicateEmailData = {
                email: 'test@example.com', // 이미 존재하는 이메일
                name: 'Duplicate Email User'
            };

            await expect(users.insert(duplicateEmailData)).rejects.toThrow();
        });

        it("외래키 제약조건을 위반하는 경우 에러가 발생해야 한다", async () => {
            const invalidOrderData = {
                user_id: 999, // 존재하지 않는 user_id
                amount: 100.00
            };

            await expect(orders.insert(invalidOrderData)).rejects.toThrow();
        });

        it("defaultValue가 적용되어야 한다", async () => {
            const userData = {
                email: 'default@example.com',
                name: 'Default Test User'
                // created_at은 defaultValue: { kind: 'now' }로 설정됨
            };

            const result = await users.insert(userData);
            expect(result).toBeDefined();

            // 삽입된 데이터 확인
            const db = users.db;
            const { rows } = await sql`SELECT created_at FROM users WHERE id = ${result.id}`.execute(db);
            expect(rows[0].created_at).toBeDefined();
        });

        it("autoIncrement가 동작해야 한다", async () => {
            const userData1 = { email: 'auto1@example.com', name: 'Auto User 1' };
            const userData2 = { email: 'auto2@example.com', name: 'Auto User 2' };

            const result1 = await users.insert(userData1);
            const result2 = await users.insert(userData2);

            expect(result2.id).toBeGreaterThan(result1.id);
        });
    });
});
