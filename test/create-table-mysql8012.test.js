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

describe.skip('[target: create-table-mysql8016.test.js]', () => {
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
    describe('SQLTable.insert() 메서드 결과 검증 테스트', () => {
        it('insert() 결과 객체가 올바른 구조를 가져야 한다', async () => {
            const insertedUser = await users.insert({
                email: 'structure@example.com',
                name: 'Structure Test',
                created_at: new Date()
            });

            expect(insertedUser).toBeDefined();
            expect(typeof insertedUser.id).toBe('number');
            expect(insertedUser.email).toBe('structure@example.com');
            expect(insertedUser.name).toBe('Structure Test');
            expect(insertedUser.created_at).toBeInstanceOf(Date);
        });

        it('insert() 후 auto increment ID가 정상적으로 증가해야 한다', async () => {
            const user1 = await users.insert({
                email: 'autoincrement1@example.com',
                name: 'User 1',
                created_at: new Date()
            });

            const user2 = await users.insert({
                email: 'autoincrement2@example.com',
                name: 'User 2',
                created_at: new Date()
            });

            expect(user2.id).toBeGreaterThan(user1.id);
            expect(user2.id - user1.id).toBe(1);
        });

        it('insert() 후 defaultValue가 적용된 컬럼을 확인할 수 있어야 한다', async () => {
            const insertedUser = await users.insert({
                email: 'defaultvalue@example.com',
                name: 'Default Value Test'
                // created_at은 생략하여 defaultValue(now) 적용
            });

            expect(insertedUser.created_at).toBeDefined();
            expect(insertedUser.created_at).toBeInstanceOf(Date);
            
            // 최근 시간이어야 함 (1분 이내)
            // const now = new Date();
            // const timeDiff = Math.abs(now.getTime() - insertedUser.created_at.getTime());
            // expect(timeDiff).toBeLessThan(60000); // 60초
        });

        it('insert() 후 모든 데이터 타입이 올바르게 반환되어야 한다', async () => {
            const testData = {
                email: 'datatypes@example.com',
                name: 'Data Types Test',
                bigint_col: 9007199254740991n,
                numeric_col: 12345.67,
                double_col: 3.14159,
                // boolean_col: true,
                // text_col: 'This is a long text content',
                // char_col: 'ABCDEFGHIJ',
                // date_col: new Date('2024-01-15'),
                // time_col: '14:30:45',
                // timestamp_col: new Date(),
                // json_col: { key: 'value', array: [1, 2, 3] },
                // uuid_col: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
                // bytes_col: Buffer.from('binary data'),
                // created_at: new Date()
            };

            const insertedUser = await users.insert(testData);

            expect(typeof insertedUser.bigint_col).toBe('number');
            expect(typeof insertedUser.numeric_col).toBe('string');
            expect(typeof insertedUser.double_col).toBe('number');
            expect(typeof insertedUser.boolean_col).toBe('object');
            expect(typeof insertedUser.text_col).toBe('object');
            expect(typeof insertedUser.char_col).toBe('object');
            // expect(insertedUser.date_col).toBeInstanceOf(Date);
            // expect(typeof insertedUser.time_col).toBe('string');
            // expect(insertedUser.timestamp_col).toBeInstanceOf(Date);
            // expect(typeof insertedUser.json_col).toBe('object');
            // expect(typeof insertedUser.uuid_col).toBe('string');
            // expect(Buffer.isBuffer(insertedUser.bytes_col)).toBe(true);
        });

        it('insert() 후 foreign key 관계가 올바르게 설정되어야 한다', async () => {
            const user = await users.insert({
                email: 'fktest@example.com',
                name: 'FK Test User',
                created_at: new Date()
            });

            const order = await orders.insert({
                user_id: user.id,
                amount: 25000,
                created_at: new Date()
            });

            expect(order.user_id).toBe(user.id);

            // JOIN 쿼리로 관계 확인
            const { rows } = await sql`
                SELECT u.email, o.amount
                FROM users u
                JOIN orders o ON u.id = o.user_id
                WHERE o.id = ${order.id}
            `.execute(users.db);

            expect(rows.length).toBe(1);
            expect(rows[0].email).toBe('fktest@example.com');
            expect(rows[0].amount).toBe(25000);
        });

        it('insert() 시 nullable: false 컬럼 누락 시 에러가 발생해야 한다', async () => {
            await expect(users.insert({
                // email 누락 (nullable: false)
                name: 'Missing Email Test',
                created_at: new Date()
            })).rejects.toThrow();

            await expect(orders.insert({
                // user_id 누락 (nullable: false)
                amount: 15000,
                created_at: new Date()
            })).rejects.toThrow();
        });

        it('insert() 시 존재하지 않는 foreign key 참조 시 에러가 발생해야 한다', async () => {
            await expect(orders.insert({
                user_id: 99999, // 존재하지 않는 user_id
                amount: 30000,
                created_at: new Date()
            })).rejects.toThrow();
        });

        it('insert() 후 복합 인덱스가 올바르게 작동해야 한다', async () => {
            const user = await users.insert({
                email: 'indextest@example.com',
                name: 'Index Test',
                created_at: new Date()
            });

            const testAmount = 50000;
            const testDate = new Date();

            await orders.insert({
                user_id: user.id,
                amount: testAmount,
                created_at: testDate
            });

            // 복합 인덱스 ix_amount_created를 활용한 쿼리
            const { rows } = await sql`
                SELECT id, amount, created_at
                FROM orders
                WHERE amount = ${testAmount}
                AND created_at >= ${testDate}
            `.execute(orders.db);

            // expect(rows.length).toBeGreaterThan(0);
            expect(rows[0].amount).toBe(testAmount);
        });
    });
        
});
