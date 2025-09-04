/**** sql-context.js | SQLContext ****/
//==============================================================
import { MetaObject } from 'logic-entity';
import { PropertyCollection } from 'logic-entity';
import { MetaTableCollection } from 'logic-entity';

import { Kysely }                       from 'kysely';
import { sql } from 'kysely';

import { detectAndStoreDbInfo } from './util/db-info.js';
import { resolveDbFeatures } from './util/db-features.js';

// REVIEW: 개발후 제거
import { viewTable } from '../temp/view-table.js';

class SQLContext extends MetaObject {
    constructor() {
        super();

        this._tables = new MetaTableCollection(this);
        this.tbl = this.tables; // tbl (alias)
        this._queries = new PropertyCollection(this);
        this.qry = this.queries; // qry (alias)
        this._contexts = new PropertyCollection(this);
        this.ctx = this.contexts; // ctx (alias)
        this._commands = new PropertyCollection(this);
        this.cmd = this.commands; // cmd (alias)
        this._procedures = new PropertyCollection(this);
        this.proc = this.procedures; // proc (alias)
        
        this._connect     = null;
        this._db          = null;
        this._profile     = {};
    }

    get tables() {
        return this._tables;
    }

    get queries() {
        return this._queries;
    }

    get contexts() {
        return this._contexts;
    }

    get commands() {
        return this._commands;
    }

    get procedures() {
        return this._procedures;
    }

    get connect() {
        return this._connect;
    }
    set connect(p_connect) {
        this._connect = p_connect;
    }

    get db () {
        if (!this._db) {
            this._db = new Kysely(this._connect);
            // DB 종류
            // resolveDbFeatures(this._db, this._connect);

            // const info = detectAndStoreDbInfo({ db: this._db, connect: this._connect }, { force: false });
            // this.vendor = info.kind;
            // this.features = resolveDbFeatures(info.kind, info.version);

            // resolveDbFeatures()
        }
        return this._db;
    }

    get profile() {
        return this._profile;
    }
    set profile(p) {
        this._profile = p;
    }

    async init() {
        const info = await detectAndStoreDbInfo(this);
        this.profile.vendor = info.kind;
        this.profile.version = info.version;
        this.profile.features = await resolveDbFeatures(info.kind, info.version);
    }

    async validateDefinition(testDb = 'testdb') {
        // TODO: 정의 검증 로직 추가
        if (this.profile.vendor === 'sqlite') {
            // SQLite에 대한 검증 로직 추가
            // await sql`ATTACH DATABASE 'file:sub.db' AS sub`.execute(db);
            await sql`ATTACH DATABASE ':memory:' AS ${testDb}`.execute(this.db);
            const sdb = this.db.withSchema(testDb);

            
            await sdb.transaction().execute(async (trx) => {
                // await trx.schema.createTable('users')
                //     .addColumn('id', 'integer', col => col.primaryKey().autoIncrement())
                //     .execute();
                
                await this.createSchema(trx, testDb);

                // TODO: dropSchema(trx); 추가 필요

                // 처리완료
                // await viewTable(sdb, '생성 검사 후 > 테이블 목록');
                await viewTable(trx, '생성 검사 후 > 테이블 목록');
                //
                throw { rollback: true };
                // throw new Error('Schema creation should have failed due to missing tables.');
            }).catch(msg => {
                // 여기서 에러 처리
                // console.warn('테이블 생성 에러:', error);
                if (msg && msg.rollback) {
                    console.log('테이블 생성 성공: ', msg);
                } else {
                    console.error('테이블 생성 에러:', msg);
                }
            });
            await viewTable(sdb, '롤백 후 > 테이블 목록');


        } else if (this.profile.vendor === 'mysql') {
            // MySQL에 대한 검증 로직 추가 TODO:
            await sql`CREATE DATABASE IF NOT EXISTS \`appdb\``.execute(this.db);
            // 풀 생성 시 database:'appdb' 지정 권장
            const mdb = this.db.withSchema('appdb'); // 멀티-벤더 호환 위해 사용 가능
            await mdb.schema.createTable('users')
                .addColumn('id', 'int', col => col.primaryKey().autoIncrement())
                .execute();

        } else if (this.profile.vendor === 'postgres') {
            // PostgreSQL에 대한 검증 로직 추가 TODO:
            await sql`CREATE SCHEMA IF NOT EXISTS "app"`.execute(this.db);
            const pdb = this.db.withSchema('app');
            await pdb.schema.createTable('users')
                .addColumn('id', 'serial', col => col.primaryKey())
                .execute();            

        } else if (this.profile.vendor === 'mssql') {
            await sql`CREATE DATABASE IF NOT EXISTS \`appdb\``.execute(this.db);
            // 풀 생성 시 database:'appdb' 지정 권장 TODO:
            const mdb = this.db.withSchema('appdb'); // 멀티-벤더 호환 위해 사용 가능
            await mdb.schema.createTable('users')
                .addColumn('id', 'int', col => col.primaryKey().autoIncrement())
                .execute();
        } else if (this.profile.vendor === 'maria') {
            // MariaDB에 대한 검증 로직 추가 TODO:
            await sql`CREATE DATABASE IF NOT EXISTS \`appdb\``.execute(this.db);
            // 풀 생성 시 database:'appdb' 지정 권장
            const mdb = this.db.withSchema('appdb'); // 멀티-벤더 호환 위해 사용 가능
            await mdb.schema.createTable('users')
                .addColumn('id', 'int', col => col.primaryKey().autoIncrement())
                .execute();
        }
    }

    async createSchema(dbOrTrx = null, schemaName = null) {
        /**
         * 우선순위
         * 1. 하위 스키마 실행
         * 2.1 테이블 생성
         * 2.2 인덱스 생성
         * 2.3 제약 조건 생성
         */
        const db = dbOrTrx || this.db;

        // TODO: DB 연결 검사

        // If not in a transaction, start one
        if (db && db.constructor && db.constructor.name === 'Kysely') {
            await db.transaction().execute(async (trx) => {
                await this._createSchemaRecursive(trx, schemaName);
            });
        } else {
            // Already in a transaction (trx)
            await this._createSchemaRecursive(db, schemaName);
        }
        // await this._createSchemaRecursive(db);

    }

    async _createSchemaRecursive(trx, schemaName) {
        for (const [index, ctx] of this.contexts.entries()) {
            if (!ctx) continue;
            if (typeof ctx.createSchema === 'function') {
                ctx.connect = this.connect;
                ctx.profile = this.profile;
                await ctx.createSchema(trx, schemaName);
            }
        }

        for (const [index, table] of this.tables.entries()) {
            if (!table) continue;
            if (typeof table.create === 'function') {
                table.connect = this.connect;
                table.profile = this.profile;
                await table.create(trx, schemaName);
            }
        }
    }

    dropSchema() {
        // Drop the database schema
    }

    ensureSchema() {
        // Ensure that the database schema is created
    }

    syncSchema() {
        // Sync the database schema with the current context
    }

    diffSchema() {
        // Compare the current schema with the database schema
    }

    // addTable(table) {
    //     this.tables.addValue(table.name, table);
    // }
}

export default SQLContext;
export { SQLContext };
