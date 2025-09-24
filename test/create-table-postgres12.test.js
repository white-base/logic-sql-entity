import { PostgresDialect, sql } from 'kysely'
import { Pool } from 'pg'
import { SQLTable } from '../src/sql-table.js';
import { convertStandardToVendor } from '../src/util/convert-data-type.js';

// jest.setTimeout(30000);

describe("[target: create-table-postgres15.test.js]", () => {
    let pool;
    let users, orders;
    const connectionString = process.env.POSTGRES_URL
        ?? process.env.KYSELY_POSTGRES_URL
        ?? 'postgres://postgres:pg123@localhost:5434/mydb';

    const normalizePostgresType = (column) => {
        const dataType = column.data_type;
        const udtName = (column.udt_name || '').toUpperCase();

        switch (dataType) {
            case 'character varying':
                return `VARCHAR(${column.character_maximum_length})`;
            case 'numeric': {
                const precision = column.numeric_precision;
                const scale = column.numeric_scale;
                if (precision != null && scale != null) {
                    return `NUMERIC(${precision},${scale})`;
                }
                if (precision != null) {
                    return `NUMERIC(${precision})`;
                }
                return 'NUMERIC';
            }
            case 'timestamp without time zone':
                return 'TIMESTAMP';
            case 'timestamp with time zone':
                return 'TIMESTAMPTZ';
            case 'time without time zone':
                return 'TIME';
            case 'double precision':
                return 'DOUBLE PRECISION';
            case 'real':
                return 'REAL';
            case 'boolean':
                return 'BOOLEAN';
            case 'date':
                return 'DATE';
            default: {
                if (udtName === 'INT4') return 'INTEGER';
                if (udtName === 'INT8') return 'BIGINT';
                if (udtName === 'FLOAT4') return 'REAL';
                if (udtName === 'FLOAT8') return 'DOUBLE PRECISION';
                if (udtName === 'BOOL') return 'BOOLEAN';
                return udtName || dataType.toUpperCase();
            }
        }
    };

    beforeAll(async () => {
        pool = new Pool({ connectionString, max: 1 });
        const dialect = new PostgresDialect({ pool });

        const connect = {
            dialect,
            log(event) {
                if (event.level === 'query') {
                    console.log('SQL:', event.query.sql);
                    console.log('Params:', event.query.parameters);
                }
            }
        };

        users = new SQLTable('users');
        users.connect = connect;
        await users.init();

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

        orders = new SQLTable('orders');
        orders.connect = connect;
        orders.columns.add('id',       { dataType: 'int', primaryKey: true, autoIncrement: true, nullable: false });
        orders.columns.add('user_id',  { dataType: 'int', nullable: false,
            references: { target: 'users.id', group: 'fk_user', onDelete: 'CASCADE', onUpdate: 'CASCADE' },
            indexes: ['ix_user'] });
        orders.columns.add('amount',   { dataType: 'int', nullable: false, indexes: ['ix_amount_created'] });
        orders.columns.add('created_at',{ dataType: 'timestamp',    nullable: false, defaultValue: { kind: 'now' }, indexes: ['ix_amount_created'] });

        const db = users.db;
        await db.schema.dropTable('orders').ifExists().execute().catch(() => {});
        await db.schema.dropTable('users').ifExists().execute().catch(() => {});

        await users.create(db);
        await orders.create(db);
    });

    afterAll(async () => {
        if (users) {
            const db = users.db;
            await db.schema.dropTable('orders').ifExists().execute().catch(() => {});
            await db.schema.dropTable('users').ifExists().execute().catch(() => {});
            await db.destroy().catch(() => {});
        }
        await pool?.end().catch(() => {});
    });

    describe("테이블 생성 및 구조 확인", () => {
        it("users 테이블이 생성되어야 한다", async () => {
            const db = users.db;
            const result = await sql`
                SELECT tablename
                FROM pg_catalog.pg_tables
                WHERE schemaname = 'public' AND tablename = 'users'
            `.execute(db);
            const row = result.rows[0];
            expect(row).toBeDefined();
            expect(row.tablename).toBe('users');
        });

        it("orders 테이블이 생성되어야 한다", async () => {
            const db = users.db;
            const result = await sql`
                SELECT tablename
                FROM pg_catalog.pg_tables
                WHERE schemaname = 'public' AND tablename = 'orders'
            `.execute(db);
            const row = result.rows[0];
            expect(row).toBeDefined();
            expect(row.tablename).toBe('orders');
        });

        it("users 테이블에 email 컬럼이 있어야 한다", async () => {
            const db = users.db;
            const { rows } = await sql`
                SELECT column_name, is_nullable
                FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'users'
            `.execute(db);
            const emailCol = rows.find(col => col.column_name === 'email');
            expect(emailCol).toBeDefined();
            expect(emailCol.is_nullable).toBe('NO');
        });

        it("orders 테이블에 user_id FK가 있어야 한다", async () => {
            const db = users.db;
            const { rows: fks } = await sql`
                SELECT tc.constraint_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
                FROM information_schema.table_constraints AS tc
                JOIN information_schema.key_column_usage AS kcu
                    ON tc.constraint_name = kcu.constraint_name AND tc.constraint_schema = kcu.constraint_schema
                JOIN information_schema.constraint_column_usage AS ccu
                    ON ccu.constraint_name = tc.constraint_name AND ccu.constraint_schema = tc.constraint_schema
                WHERE tc.constraint_type = 'FOREIGN KEY'
                  AND tc.table_schema = 'public'
                  AND tc.table_name = 'orders'
            `.execute(db);

            expect(fks).toEqual(expect.arrayContaining([
                expect.objectContaining({
                    column_name: 'user_id',
                    foreign_table_name: 'users',
                    foreign_column_name: 'id'
                })
            ]));
        });

        it("orders 테이블에 인덱스가 생성되어야 한다", async () => {
            const db = users.db;
            const { rows: indexes } = await sql`
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE schemaname = 'public' AND tablename = 'orders'
            `.execute(db);

            const findIndex = (name) => indexes.find(idx => idx.indexname === name);
            const parseIndexedColumns = (indexdef) => {
                const match = /\(([^)]+)\)/.exec(indexdef);
                if (!match) return [];
                return match[1].split(',').map((part) => part.trim().replace(/"/g, ''));
            };

            const ixUser = findIndex('idx_orders_ix_user_user_id');
            expect(ixUser).toBeDefined();
            expect(parseIndexedColumns(ixUser.indexdef)).toContain('user_id');

            const ixAmountCreated = findIndex('idx_orders_ix_amount_created_amount_created_at');
            expect(ixAmountCreated).toBeDefined();
            const cols = parseIndexedColumns(ixAmountCreated.indexdef);
            expect(cols).toEqual(expect.arrayContaining(['amount', 'created_at']));
        });
    });

    it("users 테이블의 컬럼 자료형이 올바르게 생성되어야 한다", async () => {
        const db = users.db;
        const { rows: columns } = await sql`
            SELECT column_name, data_type, udt_name, character_maximum_length, numeric_precision, numeric_scale
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'users'
        `.execute(db);

        const expectType = (colName, stdType) => {
            const col = columns.find(c => c.column_name === colName);
            expect(col).toBeDefined();
            const normalized = normalizePostgresType(col);
            const vendorType = convertStandardToVendor(stdType, 'postgres');
            expect(normalized).toBe(vendorType);
        };

        expectType('id', 'int');
        expectType('email', 'varchar(255)');
        expectType('name', 'varchar(100)');
        expectType('created_at', 'timestamp');
        expectType('bigint_col', 'bigint');
        expectType('real_col', 'real');
        expectType('double_col', 'double');
        expectType('boolean_col', 'boolean');
        expectType('date_col', 'date');
        expectType('time_col', 'time');
        expectType('timestamptz_col', 'timestamptz');
        expectType('varbinary_col', 'varbinary(255)');
        expectType('binary_col', 'binary(16)');
        expectType('blob_col', 'blob');
        expectType('json_col', 'json');
        expectType('uuid_col', 'uuid');
    });

    it("orders 테이블의 컬럼 자료형이 올바르게 생성되어야 한다", async () => {
        const db = users.db;
        const { rows: columns } = await sql`
            SELECT column_name, data_type, udt_name, character_maximum_length, numeric_precision, numeric_scale
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'orders'
        `.execute(db);

        const expectType = (colName, stdType) => {
            const col = columns.find(c => c.column_name === colName);
            expect(col).toBeDefined();
            const normalized = normalizePostgresType(col);
            const vendorType = convertStandardToVendor(stdType, 'postgres');
            expect(normalized).toBe(vendorType);
        };

        expectType('id', 'int');
        expectType('user_id', 'int');
        expectType('amount', 'int');
        expectType('created_at', 'timestamp');
    });
});
