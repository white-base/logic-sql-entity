import { MysqlDialect, sql } from 'kysely'
import mysql from 'mysql2'
import { SQLTable } from '../src/sql-table.js'
import { convertStandardToVendor } from '../src/util/convert-data-type.js'

const MARIA_CONFIG = {
    host: process.env.MARIA102_HOST ?? '127.0.0.1',
    port: Number(process.env.MARIA102_PORT ?? '3311'),
    user: process.env.MARIA102_USER ?? 'root',
    password: process.env.MARIA102_PASSWORD ?? 'root123',
    database: process.env.MARIA102_DB ?? 'mydb'
};

describe('[target: create-table-maria102.test.js]', () => {
    let users;
    let orders;

    beforeAll(async () => {
        const pool = mysql.createPool({
            host: MARIA_CONFIG.host,
            port: MARIA_CONFIG.port,
            user: MARIA_CONFIG.user,
            password: MARIA_CONFIG.password,
            database: MARIA_CONFIG.database,
            waitForConnections: true,
            connectionLimit: 5
        });

        const conn = {
            dialect: new MysqlDialect({ pool }),
                log(event) {
                if (event.level === 'query') {
                    console.log('SQL:', event.query.sql);
                    console.log('Params:', event.query.parameters);
                }
            }
        };

        users = new SQLTable('users');
        users.connect = conn;
        await users.init();

        orders = new SQLTable('orders');
        orders.connect = users.connect;

        users.columns.add('id',    { dataType: 'int', primaryKey: true, autoIncrement: true, nullable: false });
        users.columns.add('email', { dataType: 'varchar(255)', unique: true, nullable: false });
        users.columns.add('name',  { dataType: 'varchar(100)', nullable: false });
        users.columns.add('created_at', { dataType: 'timestamp', nullable: false, defaultValue: { kind: 'now' } });
        users.columns.add('bigint_col',      { dataType: 'bigint' });
        users.columns.add('real_col',        { dataType: 'real' });
        users.columns.add('double_col',      { dataType: 'double' });
        users.columns.add('boolean_col',     { dataType: 'boolean' });
        users.columns.add('date_col',        { dataType: 'date' });
        users.columns.add('time_col',        { dataType: 'time' });
        users.columns.add('timestamptz_col', { dataType: 'timestamptz' });
        users.columns.add('varbinary_col', { dataType: 'varbinary(255)' });
        users.columns.add('binary_col',    { dataType: 'binary(16)' });
        users.columns.add('blob_col',        { dataType: 'blob' });
        users.columns.add('json_col',        { dataType: 'json' });
        users.columns.add('uuid_col',        { dataType: 'uuid' });

        orders.columns.add('id',       { dataType: 'int', primaryKey: true, autoIncrement: true, nullable: false });
        orders.columns.add('user_id',  { dataType: 'int', nullable: false,
            references: { target: 'users.id', group: 'fk_user', onDelete: 'CASCADE', onUpdate: 'CASCADE' } });
        orders.columns.add('amount',   { dataType: 'numeric(12,2)', nullable: false, indexes: ['ix_user', 'ix_amount_created'] });
        orders.columns.add('created_at',{ dataType: 'timestamp',    nullable: false, defaultValue: { kind: 'now' }, indexes: ['ix_amount_created'] });

        const db = users.db;
        await sql`SET FOREIGN_KEY_CHECKS = 0`.execute(db);
        await sql`DROP TABLE IF EXISTS orders`.execute(db);
        await sql`DROP TABLE IF EXISTS users`.execute(db);
        await sql`SET FOREIGN_KEY_CHECKS = 1`.execute(db);

        await users.create();
        await orders.create();
    }, 20000);

    afterAll(async () => {
        if (!users?.db) return;
        const db = users.db;
        try {
            await sql`SET FOREIGN_KEY_CHECKS = 0`.execute(db);
            await sql`DROP TABLE IF EXISTS orders`.execute(db);
            await sql`DROP TABLE IF EXISTS users`.execute(db);
            await sql`SET FOREIGN_KEY_CHECKS = 1`.execute(db);
        } finally {
            await db.destroy();
        }
    });

    describe('테이블 생성 및 구조 확인', () => {
        it('users 테이블이 생성되어야 한다', async () => {
            const db = users.db;
            const { rows } = await sql`
                SELECT TABLE_NAME AS name
                FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = ${MARIA_CONFIG.database}
                  AND TABLE_NAME = 'users'
            `.execute(db);
            const row = rows[0];
            expect(row).toBeDefined();
            expect(row.name).toBe('users');
        });

        it('orders 테이블이 생성되어야 한다', async () => {
            const db = orders.db;
            const { rows } = await sql`
                SELECT TABLE_NAME AS name
                FROM information_schema.TABLES
                WHERE TABLE_SCHEMA = ${MARIA_CONFIG.database}
                  AND TABLE_NAME = 'orders'
            `.execute(db);
            const row = rows[0];
            expect(row).toBeDefined();
            expect(row.name).toBe('orders');
        });

        it('users 테이블에 email 컬럼이 있어야 한다', async () => {
            const db = users.db;
            const { rows: columns } = await sql`
                SELECT COLUMN_NAME AS name, IS_NULLABLE AS is_nullable
                FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = ${MARIA_CONFIG.database}
                  AND TABLE_NAME = 'users'
            `.execute(db);
            const emailCol = columns.find(col => col.name === 'email');
            expect(emailCol).toBeDefined();
            expect(emailCol.is_nullable).toBe('NO');
        });

        it('orders 테이블에 user_id FK가 있어야 한다', async () => {
            const db = orders.db;
            const { rows: fks } = await sql`
                SELECT COLUMN_NAME AS column_name, REFERENCED_TABLE_NAME AS ref_table
                FROM information_schema.KEY_COLUMN_USAGE
                WHERE TABLE_SCHEMA = ${MARIA_CONFIG.database}
                  AND TABLE_NAME = 'orders'
                  AND REFERENCED_TABLE_NAME IS NOT NULL
            `.execute(db);
            expect(fks.some(fk => fk.ref_table === 'users' && fk.column_name === 'user_id')).toBe(true);
        });

        it('orders 테이블에 인덱스가 생성되어야 한다', async () => {
            const db = orders.db;
            const { rows } = await sql`
                SELECT INDEX_NAME AS index_name, COLUMN_NAME AS column_name
                FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = ${MARIA_CONFIG.database}
                  AND TABLE_NAME = 'orders'
                  AND INDEX_NAME <> 'PRIMARY'
                ORDER BY INDEX_NAME, SEQ_IN_INDEX
            `.execute(db);

            const byIndex = rows.reduce((acc, row) => {
                const key = row.index_name;
                if (!acc[key]) acc[key] = [];
                acc[key].push(row.column_name);
                return acc;
            }, {});

            const indexNames = Object.keys(byIndex);
            expect(indexNames.some(name => name.includes('ix_user'))).toBe(true);
            expect(indexNames.some(name => name.includes('ix_amount_created'))).toBe(true);

            const ixUser = indexNames.find(name => name.includes('ix_user'));
            if (ixUser) {
                expect(byIndex[ixUser]).toEqual(expect.arrayContaining(['amount']));
            }

            const ixAmountCreated = indexNames.find(name => name.includes('ix_amount_created'));
            if (ixAmountCreated) {
                expect(byIndex[ixAmountCreated]).toEqual(expect.arrayContaining(['amount', 'created_at']));
            }
        });
    });

    it('users 테이블의 컬럼 자료형이 올바르게 생성되어야 한다', async () => {
        const db = users.db;
        const { rows: columns } = await sql`
            SELECT COLUMN_NAME AS name, COLUMN_TYPE AS column_type
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = ${MARIA_CONFIG.database}
              AND TABLE_NAME = 'users'
        `.execute(db);

        const expectType = (colName, stdType, vendorExpected = convertStandardToVendor(stdType, 'mysql')) => {
            const col = columns.find(c => c.name === colName);
            expect(col).toBeDefined();
            const actual = col.column_type.toUpperCase();
            const expected = vendorExpected.toUpperCase();
            if (!actual.startsWith(expected)) {
                expect(actual).toBe(expected);
            }
        };

        expectType('id', 'int');
        expectType('email', 'varchar(255)');
        expectType('name', 'varchar(100)');
        expectType('created_at', 'timestamp', 'DATETIME');
        expectType('bigint_col', 'bigint');
        expectType('real_col', 'real');
        expectType('double_col', 'double');
        expectType('boolean_col', 'boolean');
        expectType('date_col', 'date');
        expectType('time_col', 'time');
        expectType('timestamptz_col', 'timestamptz', 'TIMESTAMP');
        expectType('varbinary_col', 'varbinary(255)');
        expectType('binary_col', 'binary(16)');
        expectType('blob_col', 'blob', 'LONGBLOB');
        expectType('json_col', 'json', 'LONGTEXT');
        expectType('uuid_col', 'uuid');
    });

    it('orders 테이블의 컬럼 자료형이 올바르게 생성되어야 한다', async () => {
        const db = orders.db;
        const { rows: columns } = await sql`
            SELECT COLUMN_NAME AS name, COLUMN_TYPE AS column_type
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = ${MARIA_CONFIG.database}
              AND TABLE_NAME = 'orders'
        `.execute(db);

        const expectType = (colName, stdType, vendorExpected = convertStandardToVendor(stdType, 'mysql')) => {
            const col = columns.find(c => c.name === colName);
            expect(col).toBeDefined();
            const actual = col.column_type.toUpperCase();
            const expected = vendorExpected.toUpperCase();
            if (!actual.startsWith(expected)) {
                expect(actual).toBe(expected);
            }
        };

        expectType('id', 'int');
        expectType('user_id', 'int');
        expectType('amount', 'numeric(12,2)', 'DECIMAL(12,2)');
        expectType('created_at', 'timestamp', 'DATETIME');
    });
});
