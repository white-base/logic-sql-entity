/**** sql-table.js | SQLTable ****/
//==============================================================
import { MetaTable }                    from 'logic-entity';
import { MetaTableColumnCollection }    from 'logic-entity';
import { SQLRowCollection }             from './collection-sql-row.js';
import { SQLColumn }                    from './sql-column.js';
import { SQLRow }                       from './sql-row.js';

import { Kysely }                       from 'kysely'
import { sql }                          from 'kysely'
import { collectIndexGroups }           from './util/collect-index-group.js';

// local funciton
function _isObject(obj) {    // 객체 여부
    if (typeof obj === 'object' && obj !== null) return true;
    return false;
}

class SQLTable extends MetaTable {
  
    constructor(p_name) {
        super(p_name);

        this._rows        = new SQLRowCollection(this);
        this._columns     = new MetaTableColumnCollection(this, SQLColumn);

        this._connect     = null;
        this._db          = null;
        this._profile     = {};

        /**
         * 엔티티의 데이터(로우) 컬렉션
         * 
         * @readonly
         * @member {MetaRowCollection} BaseEntity#rows
         */
        Object.defineProperty(this, 'rows', {
            get: function() { return this._rows; },
            configurable: true,
            enumerable: true
        });
    }


    // get rows() {
    //     return this._rows;
    // }

    get columns() {
        return this._columns;
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

    get profile() {
        return this._profile;
    }
    set profile(p) {
        this._profile = p;
    }

    async create(trx, schemaName = null) {
        
        const db = trx || this.db;

        // table creation
        let tableBuilder = db.schema.createTable(this.tableName);
        for (const [key, col] of this.columns.entries()) {
            const options = normalizeOptions(col);
            const name = (typeof col.name === 'string' && col.name) ? col.name : key;
            const type = col.dataType || 'text';
            tableBuilder = tableBuilder.addColumn(name, type, options);
        }
        await tableBuilder.execute();

        // index creation
        const indexDefs = collectIndexGroups(this.tableName, this.columns);
        for (const indexDef of indexDefs) {
            // const isSqlite = this._connect?.dialect?.constructor?.name === 'SqliteDialect';
            
            if (this.profile.vendor === 'sqlite') {
                if (schemaName) {
                    // 함수형으로 테이블 이름 결정 REVIEW: 변경 검토
                    // SQLite: CREATE INDEX [schema.]index_name ON table (...)
                    // ON "schema"."table" is invalid for SQLite indices.
                    // Build raw SQL with schema on index name, not on the table name.
                    const resolveTableId = ({ tableName, plugins }) => {
                        const ps = plugins.find(p => p && typeof p === 'object' && 'tablePrefix' in p && 'tableSuffix' in p && 'tableMap' in p);
                        if (!ps) return tableName;
                        const tname = tableName;
                        if (ps.tableMap && typeof ps.tableMap === 'object' && ps.tableMap[tname]) {
                            return ps.tableMap[tname];
                        }
                        const patterns = Array.isArray(ps.excludeTables) ? ps.excludeTables : [];
                        const match = patterns.some((pat) =>
                            typeof pat === 'string'
                                ? (ps.caseSensitive ? tname === pat : tname.toLowerCase() === pat.toLowerCase())
                                : pat instanceof RegExp
                                    ? pat.test(tname)
                                    : false
                        );
                        if (!match) {
                            return (ps.tablePrefix || '') + tname + (ps.tableSuffix || '');
                        }
                        return tname;
                    };

                    const tableId = resolveTableId({
                        tableName: this.tableName,
                        plugins: Array.isArray(this._connect?.plugins) ? this._connect.plugins : []
                    });

                    const cols = indexDef.columns.map((c) => sql.id(c));
                    await sql`create index ${sql.id(schemaName, indexDef.name)} on ${sql.id(tableId)} (${sql.join(cols)})`.execute(db);

                    // SQLite에서는 CREATE INDEX 문에서 스키마 이름을 사용할 수 없습니다.
                    // 따라서 인덱스 이름에만 스키마 이름을 사용하고, 테이블 이름은 그대로 사용합니다.
                    // await db.withSchema('testdb').schema.createIndex(indexDef.name)
                    //     .on(this.tableName)
                    //     .columns(indexDef.columns)
                    //     .execute();
                } else {
                    await db.schema.createIndex(indexDef.name)
                        .on(this.tableName)
                        .columns(indexDef.columns)
                        .execute();
                }
            }
        }

        // inner function
        const chainOptionFns = (fns = []) => (col) => fns.reduce((acc, fn) => fn(acc), col);
        
        function normalizeOptions(options) {
            // if (!options) return undefined;
            // if (typeof options === 'function') return options;
            // if (Array.isArray(options)) return chainOptionFns(options);
            return buildColumnOptionsFromDecl(options);
        };

        function buildColumnOptionsFromDecl(def = {}) {
            return (col) => {
                if (def.pk) col = col.primaryKey();
                if (def.autoIncrement) col = col.autoIncrement();
                if (def.notNull) col = col.notNull();
                if (def.unique) col = col.unique();
                // if (def.unsigned && typeof col.unsigned === 'function') col = col.unsigned();
                // if (def.defaultTo !== undefined) col = col.defaultTo(def.defaultTo);
                // if (def.references) {
                //     const r = def.references;
                //     col = col.references(`${r.table}.${r.column}`);
                //     if (r.onDelete) col = col.onDelete(r.onDelete);
                //     if (r.onUpdate) col = col.onUpdate(r.onUpdate);
                // }
                // if (def.check) col = col.check(def.check);
                return col;
            };
        }
    }

    async select(page = 1, size = 10) {
        // page: 1부터 시작, size: 페이지당 row 수
        const limit = size > 0 ? size : 10;
        const offset = page > 1 ? (page - 1) * limit : 0;
        let rows = [];
        try {
            rows = await this.db
                .selectFrom(this.tableName)
                .selectAll()
                .limit(limit)
                .offset(offset)
                .execute();
        } catch (err) {
            if (err.message && err.message.includes('no such table')) {
                throw new Error(`테이블(${this.tableName})이 존재하지 않습니다.`);
            } else {
                throw err;
            }
        }

        rows.forEach(row => {
            this.rows.add(row);
        });

        return rows;
    }

    async insert(p_row) {
        // const tableName = this._name;
        
        
        // if (p_row instanceof this.rows._elemTypes || _isObject(p_row)) { TODO: 컬렉션 타입확인필요
        if (p_row instanceof SQLRow || _isObject(p_row)) {
            // this.rows.add(p_row);
            // TODO: p_row 에 대한 검사 필요
            const pk = 'id'
            const { [pk]: id, ...changes } = p_row
            return await this.db.insertInto(this.tableName).values({ ...changes }).execute();
        } else {
            throw new Error('Invalid row type');
        }
    }

    async update(p_row) {
        if (p_row instanceof SQLRow || _isObject(p_row)) {
            // this.rows.update(p_row);
            // return await this.db.updateTable(this.tableName).values(p_row).execute();
            const pk = 'id'
            const { [pk]: id, ...changes } = p_row
            const res = await this.db
                .updateTable(this.tableName)
                .set(changes)
                .where('id', '=', id)
                .executeTakeFirst()
            return { affectedRows: res.numUpdatedRows ?? 0 }

        } else {
            throw new Error('Invalid row type');
        }
    }

    async delete(p_row) {
        if (p_row instanceof SQLRow || _isObject(p_row)) {
            const pk = 'id'
            const { [pk]: id } = p_row
            const res = await this.db
                .deleteFrom(this.tableName)
                .where(pk, '=', id)
                .executeTakeFirst()
            return { affectedRows: res.numDeletedRows ?? 0 }

        } else {
            throw new Error('Invalid row type');
        }
    }

    /**
     * @override
     */
    async acceptChanges() {
        const trans = this.rows._transQueue.select();
        const tableName = this._name;

        for (const row of trans) {
            const pk = 'id'
            const { [pk]: id, ...changes } = row.ref
            if (row.cmd === 'I') {
                await this.db.insertInto(tableName).values({ ...changes }).execute();
            } else if (row.cmd === 'U') {
                await this.db.updateTable(tableName).set({ ...changes }).where('id', '=', id).execute();
            } else if (row.cmd === 'D') {
                await this.db.deleteFrom(tableName).where('id', '=', id).execute();
            }
        }
        this.rows.commit();
    }

    rejectChanges() {
        this.rows.rollback();
    }
}

export default SQLTable;
export { SQLTable };
