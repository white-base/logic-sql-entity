
import { SqliteDialect } from 'kysely'
import Database from 'better-sqlite3'

import { PrefixSuffixPlugin } from '../src/plugin/prefix-suffix.js';
import { SQLTable } from '../src/sql-table.js';




// 1) 테이블 정의 (SQLColumn 계약에 맞게 속성 설정)   [oai_citation:16‡sql-column.js](file-service://file-UEabZmAD8whBATVdWsCtnv)
const users = new SQLTable('users');
users.connect = {
    dialect: new SqliteDialect({
        database: new Database('mydb-custom.sqlite')  // 로컬에 파일로 생성
    }),
    log(event) {
        if (event.level === 'query') {
        console.log('SQL:', event.query.sql);
        console.log('Params:', event.query.parameters);
        }
    }
}
await users.init(); // DB 정보 감지

// users.connect = { dialect: new PostgresDialect({ /* ... */ }) }; // 또는 SqliteDialect/MySqlDialect
users.columns.add('id',    { dataType: 'int', primaryKey: true, autoIncrement: true, nullable: false });
users.columns.add('email', { dataType: 'varchar(255)', unique: true, nullable: false });
users.columns.add('name',  { dataType: 'varchar(100)', nullable: false });
users.columns.add('created_at', { dataType: 'timestamp', nullable: false, defaultValue: { kind: 'now' } });

const orders = new SQLTable('orders');
orders.connect = users.connect;
orders.columns.add('id',       { dataType: 'int', primaryKey: true, autoIncrement: true, nullable: false });
orders.columns.add('user_id',  { dataType: 'int', nullable: false,
  references: { target: 'users.id', group: 'fk_user', onDelete: 'CASCADE', onUpdate: 'CASCADE' },
  indexes: ['ix_user'] });
orders.columns.add('amount',   { dataType: 'numeric(12,2)', nullable: false, indexes: ['ix_amount_created'] });
orders.columns.add('created_at',{ dataType: 'timestamp',    nullable: false, defaultValue: { kind: 'now' }, indexes: ['ix_amount_created'] });

// 2) 3단계 실행
// await users.createStage1();        // users 먼저
// await orders.createStage1();       // orders (SQLite면 FK까지 포함)

// await users.createStage2_FKs();    // users: FK 없음 → 통과
// await orders.createStage2_FKs();   // SQLite는 자동 스킵, 그 외 벤더는 여기서 FK 추가

// await users.createStage3_Indexes();
// await orders.createStage3_Indexes();


await users.create();
await orders.create();
