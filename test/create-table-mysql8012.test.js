import { MysqlDialect, sql } from 'kysely'
import mysql from 'mysql2'
import { SQLTable } from '../src/sql-table.js'
import { convertStandardToVendor } from '../src/util/convert-data-type.js'

const MYSQL_CONFIG = {
    host: process.env.MYSQL8016_HOST ?? '127.0.0.1',
    port: Number(process.env.MYSQL8016_PORT ?? '3307'),
    user: process.env.MYSQL8016_USER ?? 'root',
    password: process.env.MYSQL8016_PASSWORD ?? 'root123',
    database: process.env.MYSQL8016_DB ?? 'mydb'
};

describe('[target: create-table-mysql8016.test.js]', () => {
    let users;
    let orders;

    beforeAll(async () => {
        const pool = mysql.createPool({
            host: MYSQL_CONFIG.host,
            port: MYSQL_CONFIG.port,
            user: MYSQL_CONFIG.user,
            password: MYSQL_CONFIG.password,
            database: MYSQL_CONFIG.database,
            waitForConnections: true,
            connectionLimit: 5
        });

        const conn = {
            dialect: new MysqlDialect({ pool }),
            log(event) {
            // if (event.level === 'query') {
                console.log('SQL:', event.query.sql);
                console.log('Params:', event.query.parameters);
            // }
            }
        };

        users = new SQLTable('users');
        users.connect = conn;
        await users.init();

        orders = new SQLTable('orders');
        orders.connect = conn;

        users.columns.add('id', { dataType: 'int', primaryKey: true, autoIncrement: true, nullable: false });
        users.columns.add('email', { dataType: 'varchar(255)', unique: true, nullable: false });
        users.columns.add('name', { dataType: 'varchar(100)', nullable: false });
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

        orders.columns.add('id', { dataType: 'int', primaryKey: true, autoIncrement: true, nullable: false });
        orders.columns.add('user_id', {
            dataType: 'int',
            nullable: false,
            references: { target: 'users.id', group: 'fk_user', onDelete: 'CASCADE', onUpdate: 'CASCADE' },
            indexes: ['ix_user']
        });
        orders.columns.add('amount', {
            dataType: 'int',
            nullable: false,
            indexes: ['ix_amount_created']
        });
        orders.columns.add('created_at', {
            dataType: 'timestamp',
            nullable: false,
            defaultValue: { kind: 'now' },
            indexes: ['ix_amount_created']
        });

        const db = users.db;
        await sql`SET FOREIGN_KEY_CHECKS = 0`.execute(db);  // FK 제약조건 해제
        await sql`DROP TABLE IF EXISTS orders`.execute(db);
        await sql`DROP TABLE IF EXISTS users`.execute(db);
        await sql`SET FOREIGN_KEY_CHECKS = 1`.execute(db);  // FK 제약조건 설정

        await users.create();
        await orders.create(db);
        }, 20000);

        afterAll(async () => {
        if (!users?.db) return;
        const db = users.db;
        try {
            // await sql`SET FOREIGN_KEY_CHECKS = 0`.execute(db);
            // await sql`DROP TABLE IF EXISTS orders`.execute(db);
            // await sql`DROP TABLE IF EXISTS users`.execute(db);
            // await sql`SET FOREIGN_KEY_CHECKS = 1`.execute(db);
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
            WHERE TABLE_SCHEMA = ${MYSQL_CONFIG.database}
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
            WHERE TABLE_SCHEMA = ${MYSQL_CONFIG.database}
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
            WHERE TABLE_SCHEMA = ${MYSQL_CONFIG.database}
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
            WHERE TABLE_SCHEMA = ${MYSQL_CONFIG.database}
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
            WHERE TABLE_SCHEMA = ${MYSQL_CONFIG.database}
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
            expect(byIndex[ixUser]).toEqual(expect.arrayContaining(['user_id']));
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
            WHERE TABLE_SCHEMA = ${MYSQL_CONFIG.database}
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

        expectType('id', 'int', 'INT(11)');
        expectType('email', 'varchar(255)', 'VARCHAR');
        expectType('name', 'varchar(100)', 'VARCHAR');

        expectType('bigint_col', 'bigint', 'BIGINT');
        expectType('numeric_col', 'numeric(18, 2)', 'DECIMAL');
        expectType('double_col', 'double', 'DOUBLE');
        expectType('text_col', 'text', 'TEXT');
        expectType('char_col', 'char(10)', 'CHAR');

        expectType('date_col', 'date', 'DATE');
        expectType('time_col', 'time', 'TIME');
        expectType('timestamp_col', 'timestamp', 'DATETIME');

        expectType('json_col', 'json', 'JSON');
        expectType('uuid_col', 'uuid', 'CHAR');
        expectType('bytes_col', 'bytes', 'VARBINARY');
    });

    it('orders 테이블의 컬럼 자료형이 올바르게 생성되어야 한다', async () => {
        const db = orders.db;
        const { rows: columns } = await sql`
            SELECT COLUMN_NAME AS name, COLUMN_TYPE AS column_type
            FROM information_schema.COLUMNS
            WHERE TABLE_SCHEMA = ${MYSQL_CONFIG.database}
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

        expectType('id', 'int', 'INT(11)');
        expectType('user_id', 'int', 'INT(11)');
        expectType('amount', 'int', 'INT(11)');
        expectType('created_at', 'timestamp', 'DATETIME');
    });
    describe('데이터 삽입(insert) 테스트', () => {
        it('users 테이블에 데이터를 삽입할 수 있어야 한다', async () => {
            const db = users.db;
            const insertResult = await sql`
                INSERT INTO users (email, name, created_at)
                VALUES ('testuser@example.com', 'Test User', NOW())
            `.execute(db);
            expect(insertResult.numAffectedRows).toBe(1n);

            const { rows } = await sql`
                SELECT email, name FROM users WHERE email = 'testuser@example.com'
            `.execute(db);
            expect(rows.length).toBe(1);
            expect(rows[0].email).toBe('testuser@example.com');
            expect(rows[0].name).toBe('Test User');
        });

        it('orders 테이블에 데이터를 삽입할 수 있어야 한다', async () => {
            const db = orders.db;
            // 먼저 users에 한 명을 추가
            const userInsert = await sql`
                INSERT INTO users (email, name, created_at)
                VALUES ('orderuser@example.com', 'Order User', NOW())
            `.execute(db);
            const { rows: userRows } = await sql`
                SELECT id FROM users WHERE email = 'orderuser@example.com'
            `.execute(db);
            const userId = userRows[0].id;

            const orderInsert = await sql`
                INSERT INTO orders (user_id, amount, created_at)
                VALUES (${userId}, 5000, NOW())
            `.execute(db);
            expect(orderInsert.numAffectedRows).toBe(1n);

            const { rows: orderRows } = await sql`
                SELECT user_id, amount FROM orders WHERE user_id = ${userId}
            `.execute(db);
            expect(orderRows.length).toBe(1);
            expect(orderRows[0].user_id).toBe(userId);
            expect(orderRows[0].amount).toBe(5000);
        });

        it('users 테이블에 unique 제약조건 위반 시 에러가 발생해야 한다', async () => {
            const db = users.db;
            await sql`
                INSERT INTO users (email, name, created_at)
                VALUES ('uniqueuser@example.com', 'Unique User', NOW())
            `.execute(db);

            // 동일한 email로 다시 insert 시도
            await expect(sql`
                INSERT INTO users (email, name, created_at)
                VALUES ('uniqueuser@example.com', 'Another User', NOW())
            `.execute(db)).rejects.toThrow();
        });
        it('orders 테이블에 table.insert()로 데이터를 삽입할 수 있어야 한다', async () => {
            const user = await users.insert({
                email: 'tableinsert@example.com',
                name: 'Table Insert',
                created_at: new Date()
            });
            expect(user.id).toBeDefined();

            const order = await orders.insert({
                user_id: user.id,
                amount: 12345,
                created_at: new Date()
            });
            expect(order.id).toBeDefined();

            const { rows } = await sql`
                SELECT user_id, amount FROM orders WHERE id = ${order.id}
            `.execute(orders.db);
            expect(rows.length).toBe(1);
            expect(rows[0].user_id).toBe(user.id);
            expect(rows[0].amount).toBe(12345);
        });
    });
        
});
