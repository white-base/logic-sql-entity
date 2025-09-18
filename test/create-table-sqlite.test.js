import { SqliteDialect, sql } from 'kysely'
import Database from 'better-sqlite3'
import { SQLTable } from '../src/sql-table.js';
import { convertStandardToVendor } from '../src/util/convert-data-type.js'; // 추가

describe("[target: create-table-test.js]", () => {
    let users, orders;
    let dbFile = 'mydb-test.sqlite';

    beforeAll(async () => {
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
        
        users.columns.add('int_col',         { dataType: 'int' });
        users.columns.add('bigint_col',      { dataType: 'bigint' });
        users.columns.add('numeric_col',     { dataType: 'numeric(18,2)' });
        users.columns.add('real_col',        { dataType: 'real' });
        users.columns.add('double_col',      { dataType: 'double' });
        users.columns.add('boolean_col',     { dataType: 'boolean' });
        
        users.columns.add('varchar_col',     { dataType: 'varchar(255)' });
        users.columns.add('text_col',        { dataType: 'text' });

        users.columns.add('date_col',        { dataType: 'date' });
        users.columns.add('time_col',        { dataType: 'time' });
        users.columns.add('timestamp_col',   { dataType: 'timestamp' });
        users.columns.add('timestamptz_col', { dataType: 'timestamptz' });
        
        users.columns.add('binary_col',    { dataType: 'binary(16)' });
        users.columns.add('varbinary_col', { dataType: 'varbinary(255)' });
        users.columns.add('blob_col',        { dataType: 'blob' });
        users.columns.add('json_col',        { dataType: 'json' });
        users.columns.add('uuid_col',        { dataType: 'uuid' });
        users.columns.add('char_col',        { dataType: 'char(10)' });

        orders = new SQLTable('orders');
        orders.connect = users.connect;
        orders.columns.add('id',       { dataType: 'int', primaryKey: true, autoIncrement: true, nullable: false });
        orders.columns.add('user_id',  { dataType: 'int', nullable: false,
            references: { target: 'users.id', group: 'fk_user', onDelete: 'CASCADE', onUpdate: 'CASCADE' },
            indexes: ['ix_user'] });
        orders.columns.add('amount',   { dataType: 'numeric(12,2)', nullable: false, indexes: ['ix_amount_created'] });
        orders.columns.add('created_at',{ dataType: 'timestamp',    nullable: false, defaultValue: { kind: 'now' }, indexes: ['ix_amount_created'] });

        const db = users.db;
        await sql`PRAGMA foreign_keys = ON`.execute(db);
        await sql`PRAGMA journal_mode = WAL`.execute(db);
        await sql`PRAGMA synchronous = NORMAL`.execute(db);

        // 기존에 테이블이 있으면 삭제
        await sql`DROP TABLE IF EXISTS orders`.execute(db);
        await sql`DROP TABLE IF EXISTS users`.execute(db);

        await users.create();
        await orders.create();
    });

    afterAll(() => {});

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

    it("users 테이블의 컬럼 자료형이 올바르게 생성되어야 한다", async () => {
        const db = users.db;
        const { rows: columns } = await sql`PRAGMA table_info(users)`.execute(db);

        // 표준 타입 → sqlite 타입 변환 후 비교
        const expectType = (colName, stdType, vendorTypeExpected) => {
            const col = columns.find(c => c.name === colName);
            expect(col).toBeDefined();
            const vendorType = convertStandardToVendor(stdType, 'sqlite');
            expect(col.type.toUpperCase()).toBe(vendorType);
            expect(col.type.toUpperCase()).toBe(vendorTypeExpected);
        };

        expectType('id', 'int', 'INTEGER');
        expectType('email', 'varchar(255)', 'TEXT');
        expectType('name', 'varchar(100)', 'TEXT');
        expectType('created_at', 'timestamp', 'NUMERIC');
        expectType('bigint_col', 'bigint', 'INTEGER');
        expectType('real_col', 'real', 'REAL');
        expectType('double_col', 'double', 'REAL');
        expectType('boolean_col', 'boolean', 'INTEGER');
        expectType('date_col', 'date', 'NUMERIC');
        expectType('time_col', 'time', 'NUMERIC');
        expectType('timestamptz_col', 'timestamptz', 'NUMERIC');
        expectType('varbinary_col', 'varbinary(255)', 'BLOB');
        expectType('binary_col', 'binary(16)', 'BLOB');
        expectType('blob_col', 'blob', 'BLOB');
        expectType('json_col', 'json', 'TEXT');
        expectType('uuid_col', 'uuid', 'TEXT');
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
