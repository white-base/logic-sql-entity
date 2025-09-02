/**** sql-context.js | SQLContext ****/
//==============================================================
import { MetaObject } from 'logic-entity';
import { PropertyCollection } from 'logic-entity';
import { MetaTableCollection } from 'logic-entity';

import { Kysely }                       from 'kysely';
import { detectAndStoreDbInfo } from './util/db-info.js';
import { resolveDbFeatures } from './util/db-features.js';

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

    async createSchema() {
        /**
         * 우선순위
         * 1. 하위 스키마 실행
         * 2.1 테이블 생성
         * 2.2 인덱스 생성
         * 2.3 제약 조건 생성
         */

        // TODO: DB 연결 검사

        // 하위 스키마 실행 (순차적으로 대기)
        const childContexts = [];
        this.contexts.forEach((ctx) => childContexts.push(ctx));
        for (const ctx of childContexts) {
            if (!ctx) continue;
            ctx.connect = this.connect;
            await ctx.createSchema();
        }

        // 테이블 생성 (순차적으로 대기)
        const childTables = [];
        this.tables.forEach((tbl) => childTables.push(tbl));
        for (const table of childTables) {
            if (!table) continue;
            table.connect = this.connect;
            await table.createSchema();
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

    async init() {
        const info = await detectAndStoreDbInfo(this);
        this.profile.vendor = info.kind;
        this.profile.version = info.version;
        this.profile.features = await resolveDbFeatures(info.kind, info.version);
    }
}

export default SQLContext;
export { SQLContext };
