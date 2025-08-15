/**** sql-table.js | SQLTable ****/
//==============================================================
import { MetaTable }                    from 'logic-entity';
import { MetaTableColumnCollection }    from 'logic-entity';
import { SQLRowCollection }             from './collection-sql-row.js';
import { SQLColumn }                    from './sql-column.js';
import { SQLRow }                       from './sql-row.js';

import { Kysely }                       from 'kysely'

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

    async select(page = 1, size = 10) {
        // page: 1부터 시작, size: 페이지당 row 수
        const limit = size > 0 ? size : 10;
        const offset = page > 1 ? (page - 1) * limit : 0;
        const rows = await this.db
            .selectFrom(this.tableName)
            .selectAll()
            .limit(limit)
            .offset(offset)
            .execute();

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