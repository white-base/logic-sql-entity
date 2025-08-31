/**** sql-context.js | SQLContext ****/
//==============================================================
import { MetaObject } from 'logic-entity';
import { PropertyCollection } from 'logic-entity';
import { MetaTableCollection } from 'logic-entity';

import { Kysely }                       from 'kysely'

class SQLContext extends MetaObject {
    constructor() {
        super();

        this.tables = new MetaTableCollection(this);
        this.queries = new PropertyCollection(this);
        this.contexts = new PropertyCollection(this);
        this._connect     = null;
        this._db          = null;
        // this.tables.
    }

    get connect() {
        return this._connect;
    }
    set connect(p_connect) {
        this._connect = p_connect;
    }

    get db() {
        if (!this._db) {
            this._db = new Kysely(this._connect);
        }
        return this._db;
    }

    createSchema() {
        /**
         * 우선순위
         * 1. 하위 스키마 실행
         * 2.1 테이블 생성
         * 2.2 인덱스 생성
         * 2.3 제약 조건 생성
         */

        // TODO: DB 연결 검사

        // 하위 스키마 실행
        this.contexts.forEach( (ctx) => {
            // TODO: 위치 조정
            ctx.connect = this.connect;
            ctx.createSchema();
        });

        // 테이블 생성
        this.tables.forEach( (table) => {
            // TODO: 위치 조정
            table.connect = this.connect;
            table.createSchema();
        });

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