import { Kysely, sql } from 'kysely'
import { MssqlDialect } from 'kysely'
// import mssql from 'mssql'
import * as tedious from 'tedious'
import * as tarn from 'tarn'
import { SQLTable } from '../src/sql-table.js'
import { convertStandardToVendor } from '../src/util/convert-data-type.js'

const MSSQL_CONFIG = {
    user: process.env.MSSQL2022_USER ?? 'sa',
    password: process.env.MSSQL2022_PASSWORD ?? 'Your_password123',
    server: process.env.MSSQL2022_HOST ?? '127.0.0.1',
    port: Number(process.env.MSSQL2022_PORT ?? '1435'),
    database: process.env.MSSQL2022_DB ?? 'mydb',
    trustServerCertificate: true,
    enableArithAbort: true,
    pool: {
        max: 5,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

describe('[target: create-table-mssql2022.test.js]', () => {
    let users, orders;
    let db;

    beforeAll(async () => {
        // mssql pool 생성
        const dialectConfig = {
            tarn: {
                ...tarn,
                options: {
                    min: 0,
                    max: 10,
                },
            },
            tedious: {
                ...tedious,
                connectionFactory: () => new tedious.Connection({
                    authentication: {
                        options: {
                            password: 'Your_password123',
                            userName: 'sa',
                        },
                        type: 'default',
                    },
                    options: {
                        database: 'mydb',
                        port: 1435,
                        trustServerCertificate: true,
                    },
                    server: 'localhost',
                }),
            },
        }

        // db = new Kysely({
        //     dialect: new MssqlDialect({ pool }),
        // });

        users = new SQLTable('users');
        users.connect = { 
            dialect: new MssqlDialect(dialectConfig),
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
        // users.columns.add('created_at', { dataType: 'datetime', nullable: false});
        users.columns.add('bigint_col',      { dataType: 'bigint' });
        users.columns.add('numeric_col',      { dataType: 'numeric(10,2)' });
        // users.columns.add('real_col',        { dataType: 'real' });
        users.columns.add('double_col',      { dataType: 'double' });
        users.columns.add('boolean_col',      { dataType: 'boolean' });

        users.columns.add('text_col',      { dataType: 'text' });
        users.columns.add('char_col',      { dataType: 'char' });

        // users.columns.add('boolean_col',     { dataType: 'bit' });
        users.columns.add('date_col',        { dataType: 'date' });
        users.columns.add('time_col',        { dataType: 'time' });
        users.columns.add('timestamp_col',        { dataType: 'timestamp' });
        // users.columns.add('timestamptz_col', { dataType: 'datetimeoffset' });
        // users.columns.add('varbinary_col',   { dataType: 'varbinary(255)' });
        // users.columns.add('binary_col',      { dataType: 'binary(16)' });
        // users.columns.add('blob_col',        { dataType: 'varbinary(max)' });
        users.columns.add('json_col',        { dataType: 'json' });
        users.columns.add('uuid_col',        { dataType: 'uuid' });
        users.columns.add('bytes_col',        { dataType: 'bytes' });

        orders = new SQLTable('orders');
        orders.connect = users.connect;
        orders.columns.add('id',       { dataType: 'int', primaryKey: true, autoIncrement: true, nullable: false });
        orders.columns.add('user_id',  { dataType: 'int', nullable: false,
            references: { target: 'users.id', group: 'fk_user', onDelete: 'CASCADE', onUpdate: 'CASCADE' },
            indexes: ['ix_user'] });
        orders.columns.add('amount',   { dataType: 'int', nullable: false, indexes: ['ix_amount_created'] });
        // orders.columns.add('created_at',{ dataType: 'int',    nullable: false, defaultValue: { kind: 'now' }, indexes: ['ix_amount_created'] });
        orders.columns.add('created_at',{ dataType: 'int',    nullable: false, indexes: ['ix_amount_created'] });

        db = users.db;
        // 기존 테이블 삭제
        await sql`IF OBJECT_ID('orders', 'U') IS NOT NULL DROP TABLE orders`.execute(db);
        await sql`IF OBJECT_ID('users', 'U') IS NOT NULL DROP TABLE users`.execute(db);

        await users.create();
        await orders.create(db);
    }, 30000);

    afterAll(async () => {
        if (db) await db.destroy();
        // await mssql.close();
    });

    describe("테이블 생성 및 구조 확인", () => {
        it("users 테이블이 생성되어야 한다", async () => {
            const { rows } = await sql`
                SELECT TABLE_NAME as name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'users'
            `.execute(db);
            const row = rows[0];
            expect(row).toBeDefined();
            expect(row.name).toBe('users');
        });

        it("orders 테이블이 생성되어야 한다", async () => {
            const { rows } = await sql`
                SELECT TABLE_NAME as name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'orders'
            `.execute(db);
            const row = rows[0];
            expect(row).toBeDefined();
            expect(row.name).toBe('orders');
        });

        it("users 테이블에 email 컬럼이 있어야 한다", async () => {
            const { rows: columns } = await sql`
                SELECT COLUMN_NAME, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users'
            `.execute(db);
            const emailCol = columns.find(col => col.COLUMN_NAME === 'email');
            expect(emailCol).toBeDefined();
            expect(emailCol.IS_NULLABLE).toBe('NO');
        });

        it("orders 테이블에 user_id FK가 있어야 한다", async () => {
            const { rows: fks } = await sql`
                SELECT fk.name AS fk_name, col.name AS col_name, ref.name AS ref_table
                FROM sys.foreign_keys fk
                INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
                INNER JOIN sys.tables t ON fk.parent_object_id = t.object_id
                INNER JOIN sys.columns col ON fkc.parent_column_id = col.column_id AND fkc.parent_object_id = col.object_id
                INNER JOIN sys.tables ref ON fk.referenced_object_id = ref.object_id
                WHERE t.name = 'orders'
            `.execute(db);
            expect(fks.some(fk => fk.col_name === 'user_id' && fk.ref_table === 'users')).toBe(true);
        });

        it("orders 테이블에 인덱스가 생성되어야 한다", async () => {
            const { rows: indexes } = await sql`
                SELECT i.name AS index_name
                FROM sys.indexes i
                INNER JOIN sys.tables t ON i.object_id = t.object_id
                WHERE t.name = 'orders' AND i.is_primary_key = 0 AND i.type_desc = 'NONCLUSTERED'
            `.execute(db);
            const indexNames = indexes.map(idx => idx.index_name);

            // ix_user, ix_amount_created 인덱스가 존재해야 함
            expect(indexNames.some(name => name.includes('ix_user'))).toBe(true);
            expect(indexNames.some(name => name.includes('ix_amount_created'))).toBe(true);

            // 인덱스 컬럼 확인
            const getIndexColumns = async (indexName) => {
                const { rows } = await sql`
                    SELECT c.name FROM sys.index_columns ic
                    INNER JOIN sys.columns c ON ic.column_id = c.column_id AND ic.object_id = c.object_id
                    INNER JOIN sys.indexes i ON ic.object_id = i.object_id AND ic.index_id = i.index_id
                    INNER JOIN sys.tables t ON i.object_id = t.object_id
                    WHERE t.name = 'orders' AND i.name = ${indexName}
                    ORDER BY ic.key_ordinal
                `.execute(db);
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
        const { rows: columns } = await sql`
            SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'users'
        `.execute(db);

        const expectType = (colName, stdType, vendorTypeExpected) => {
            const col = columns.find(c => c.COLUMN_NAME === colName);
            expect(col).toBeDefined();
            const vendorType = convertStandardToVendor(stdType, 'mssql');
            expect(col.DATA_TYPE.toUpperCase()).toBe(vendorTypeExpected);
        };

        expectType('id', 'int', 'INT');
        expectType('email', 'varchar(255)', 'VARCHAR');
        expectType('name', 'varchar(100)', 'VARCHAR');
        // expectType('created_at', 'datetime2', 'DATETIME2');
        expectType('bigint_col', 'bigint', 'BIGINT');
        expectType('numeric_col', 'numeric(18, 2)', 'NUMERIC');
        expectType('double_col', 'double', 'FLOAT');
        expectType('text_col', 'text', 'VARCHAR');
        expectType('char_col', 'char(10)', 'CHAR');
        //
        // expectType('real_col', 'real', 'REAL');
        // expectType('double_col', 'float', 'FLOAT');
        // expectType('boolean_col', 'bit', 'BIT');
        expectType('date_col', 'date', 'DATE');
        expectType('time_col', 'time', 'TIME');
        expectType('timestamp_col', 'timestamp', 'DATETIME');
        // expectType('timestamptz_col', 'datetimeoffset', 'DATETIMEOFFSET');
        // expectType('varbinary_col', 'varbinary(255)', 'VARBINARY');
        // expectType('binary_col', 'binary(16)', 'BINARY');
        expectType('json_col', 'json', 'VARCHAR');
        expectType('uuid_col', 'uuid', 'VARCHAR');
        expectType('bytes_col', 'bytes', 'VARBINARY');
    });

    it("orders 테이블의 컬럼 자료형이 올바르게 생성되어야 한다", async () => {
        const { rows: columns } = await sql`
            SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'orders'
        `.execute(db);

        const expectType = (colName, stdType, vendorTypeExpected) => {
            const col = columns.find(c => c.COLUMN_NAME === colName);
            expect(col).toBeDefined();
            const vendorType = convertStandardToVendor(stdType, 'mssql');
            expect(col.DATA_TYPE.toUpperCase()).toBe(vendorTypeExpected);
        };

        expectType('id', 'int', 'INT');
        expectType('user_id', 'int', 'INT');
        expectType('amount', 'numeric(12,2)', 'INT');
        expectType('created_at', 'datetime2', 'INT');
    });
});
