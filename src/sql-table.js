/**** sql-table.js | SQLTable ****/
//==============================================================
import { MetaTable }                    from 'logic-entity';
import { MetaTableColumnCollection }    from 'logic-entity';
import { EventEmitter }                 from 'logic-entity';
import { ExtendError }                  from 'logic-entity';
import { MetaRow }                      from 'logic-entity';
// import { SQLRowCollection }             from './collection-sql-row.js';
import { SQLColumn }                    from './sql-column.js';
// import { SQLRow }                       from './sql-row.js';

import { Kysely }                       from 'kysely'
import { sql }                          from 'kysely'
import { collectIndexGroups }           from './util/collect-index-group.js';
import { convertStandardToVendor }     from './util/convert-data-type.js';
import { applyDefault }                from './util/apply-default.js';
import { detectAndStoreDbInfo, getDbInfo } from './util/db-info.js';
import { resolveDbFeatures }            from './util/db-features.js';

// local funciton
function _isObject(obj) {    // 객체 여부
    if (typeof obj === 'object' && obj !== null) return true;
    return false;
}

class SQLTable extends MetaTable {
  
    constructor(p_name) {
        super(p_name);

        this.columns._baseType = SQLColumn; // 강제 설정
        this.rows.autoChanges = false;

        this._connect     = null;
        this._db          = null;
        this._profile     = { vendor: null, version: null, features: null }; // { vendor: 'mysql' | 'postgres' | 'sqlite' | 'mssql' }
        this._event       = new EventEmitter();
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

    onCreating(handler) {
        return this._event.on('creating', handler);
    }

    onCreated(handler) {
        return this._event.on('created', handler);
    }

    onDropping(handler) {
        return this._event.on('dropping', handler);
    }

    onDropped(handler) {
        return this._event.on('dropped', handler);
    }

    onInserting(handler) {
        return this._event.on('inserting', handler);
    }

    onInserted(handler) {
        return this._event.on('inserted', handler);
    }

    onSelecting(handler) {
        return this._event.on('selecting', handler);
    }

    onSelected(handler) {
        return this._event.on('selected', handler);
    }

    onUpdating(handler) {
        return this._event.on('updating', handler);
    }

    onUpdated(handler) {
        return this._event.on('updated', handler);
    }

    onDeleting(handler) {
        return this._event.on('deleting', handler);
    }

    onDeleted(handler) {
        return this._event.on('deleted', handler);
    }

    onDeleteFailed(handler) {
        return this._event.on('deleteFailed', handler);
    }

    async $create(trx) {
        const builders = [];

        builders.push(await this._createStage1(trx));    
        builders.push(...await this._createStage2_FKs(trx));
        builders.push(...await this._createStage3_Indexes(trx));
        return builders;
    }

    async $drop(trx) {
        const db = trx || this.db;
        const builder = db.schema.dropTable(this.tableName).ifExists();
        // 실행은 drop에서, 여기서는 builder만 리턴
        return builder;
    }

    async $insert(p_data, trx) {
        const db = trx || this.db;
        const data = {};
        let query = null;

        if (p_data instanceof MetaRow) {
            for (let i = 0; i < p_data.count; i++) {
                const key = this.columns.indexToKey(i);
                if (this.columns.existColumnName(key)) {
                    data[key] = p_data[key];
                }
            }

        } else if (_isObject(p_data)) {
            for (const key in p_data) {
                if (!Object.prototype.hasOwnProperty.call(p_data, key)) continue;
                if (this.columns.existColumnName(key)) {
                    data[key] = p_data[key];
                }
            }

        } else {
            throw new Error('Invalid row type');
        }

        let result;
        if (this.profile.features?.hasReturning === true) {
            result = await this.db.insertInto(this.tableName)
                .values({ ...data })
                .returningAll();
                // .executeTakeFirst();            

        } else {
            result = await db.insertInto(this.tableName)
                .values({ ...data });
                // .executeTakeFirstOrThrow();
        }

        // console.log(result);
        return result;
    }

    async $select(selOpt, trx) {
        const db = trx || this.db;
        // page: 1부터 시작, size: 페이지당 row 수
        const limit = selOpt.size > 0 ? selOpt.size : 10;
        const offset = selOpt.page > 1 ? (selOpt.page - 1) * limit : 0;
        let rows = [];
        let query;
        // if (!db) return rows;

        try {
            query = db.selectFrom(this.tableName)
                .selectAll()
                .limit(limit)
                .offset(offset);

            // TODO: select, where, orderby, groupby, having 등 옵션 처리
            for (const key in selOpt.where) {
                if (this.columns.existColumnName(key) === false) continue;
                if (Object.prototype.hasOwnProperty.call(selOpt.where, key)) {
                    query = query.where(key, '=', selOpt.where[key]);
                }
            }
            // rows = await query.execute();
            
        } catch (err) {
            if (err.message && err.message.includes('no such table')) {
                throw new Error(`테이블(${this.tableName})이 존재하지 않습니다.`);
            } else {
                throw err;
            }
        }
        return query;   // TODO: 위치 try 밖으로 빼기
    }

    async $delete(p_where, trx) {
        let pkCount = 0; // PK 조건 개수 카운트
        const db = trx || this.db;
        let builder;

        try {
            if (p_where instanceof MetaRow || _isObject(p_where)) {
                builder = db.deleteFrom(this.tableName);
            
                this.columns.forEach((col, key) => {
                    if(col.primaryKey !== true) return; // PK만 조건
                    if(col.virtual === true) return;  // 가상 컬럼 스킵
                    builder = builder.where(col.columnName, '=', p_where[col.columnName]);
                    pkCount++;
                });

                // PK 조건이 없으면 예외 발생
                if (pkCount === 0) {
                    throw new Error('delete: PK 조건이 없어 전체 테이블이 삭제될 수 있습니다.');
                }

                // await builder.executeTakeFirst();
                // return { affectedRows: res.numDeletedRows ?? 0 }

            } else {
                throw new Error('Invalid row type');
            }
        } catch (err) {
            throw new Error('Invalid row type' + err.message);
        }
        return builder;
    }

    async $update(p_updOpt, trx) {
        const change = {};
        let pkCount = 0; // PK 조건 개수 카운트

        try {
            let query = await this.db.updateTable(this.tableName);

            if (p_updOpt instanceof MetaRow) {
                for (let i = 0; i < p_updOpt.count; i++) {
                    // const key = p_row[i].columnName;
                    const col = this.columns[i];
                    if(col.primaryKey === true) continue; // PK만 조건
                    if(col.virtual === true) continue;  // 가상 컬럼 스킵
                    change[col.columnName] = p_updOpt[i];
                }
            } else if (_isObject(p_updOpt)) {
                for (const key in p_updOpt) {
                    if (!Object.prototype.hasOwnProperty.call(p_updOpt, key)) continue;
                    const col = this.columns[key];
                    if (!col) continue;
                    if (col.primaryKey === true) continue; // PK만 조건
                    if (col.virtual === true) continue;  // 가상 컬럼 스킵
                    change[key] = p_updOpt[key];
                }
            } else {
                throw new Error('Invalid row type');
            }
            query = query.set(change);

            this.columns.forEach((col, key) => {
                if(col.primaryKey === false) return; // PK만 조건
                if(col.virtual == true) return;  // 가상 컬럼 스킵
                query = query.where(col.columnName, '=', p_updOpt[col.columnName]);
                pkCount++;
            });
            // PK 조건이 없으면 예외 발생
            if (pkCount === 0) {
                throw new Error('update: PK 조건이 없어 전체 테이블이 수정될 수 있습니다.');
            }

            const result = query;
            return result;

        } catch (err) {
            throw new Error('Invalid row type' + err.message);
        }
    }

    async init() {
        const info = await detectAndStoreDbInfo(this);
        this.profile.vendor = info.kind;
        this.profile.version = info.version;
        this.profile.features = resolveDbFeatures(info.kind, info.version);
    }

    getPrimaryKeyColumns() {
        return this.columns.filter(c => c.primaryKey && !c.virtual).map(c => c.columnName);
    }

    async create(trx) {
        const db = trx || this.db;

        // pre-create event   TODO: 파라메터 정리 필요
        await this._event.emit('creating', { table: this, db: db });

        const builders = await this.$create(db);
        for (const b of builders) {
            await b.execute();
        }
        // post-create event
        await this._event.emit('created', { table: this, db: db });
    }

    // ############################################
    /* ============================================================
    * 3-Stage DDL: Stage1 → Stage2 → Stage3
    *   Stage1: 테이블 + 컬럼 + (복합)PK + UNIQUE  (+ SQLite는 FK까지)
    *   Stage2: FK (SQLite는 스킵)
    *   Stage3: 보조 인덱스
    * ============================================================ */

    /** Stage1: 테이블/컬럼 + PK + UNIQUE (+SQLite는 FK 포함) */
    async _createStage1(trx, options = { execute: true }) {
        const db = trx || this.db;

        // DB 정보 감지(벤더/버전) → features/vendortype에 사용
        const info = await detectAndStoreDbInfo({ db, connect: { dialect: this._connect?.dialect } });
        const vendor = info?.flavor || info?.kind || (this.profile?.vendor ?? 'unknown');

        // SQLite: FK 활성화
        if (vendor === 'sqlite') {
            // await db.execute(sql`PRAGMA foreign_keys = ON`);
            await sql`PRAGMA foreign_keys = ON`.execute(db);
            // await db.executeQuery(sql`PRAGMA foreign_keys = ON`);
        }

        // 테이블 빌드: 컬럼/타입/NULL/기본값/autoInc/PK/UNIQUE
        let tb = db.schema.createTable(this.tableName);

        // 1) addColumn
        for (const [key, col] of this.columns.entries()) {
            const name = (typeof col.name === 'string' && col.name) ? col.name : key;
            const stdType = col.dataType || 'text';
            const vendorType = col?.vendor?.[vendor]?.dataType || convertStandardToVendor(stdType, vendor).toLowerCase(); // 벤더 지정 우선, 없으면 변환   [oai_citation:13‡convert-data-type.js](file-service://file-Qb3v2NGwg15TAUNpa2xSBn)
            // const vendorType = convertStandardToVendor(stdType, vendor).toLowerCase();                // 표준 → 벤더 타입   [oai_citation:13‡convert-data-type.js](file-service://file-Qb3v2NGwg15TAUNpa2xSBn)
            if (col.virual === true) continue; // 가상 컬럼 스킵

            tb = tb.addColumn(name, vendorType, (c0) => {
                let c = c0;
                if (col.nullable === false) c = c.notNull();
                if (col.autoIncrement)      c = applyAutoIncrementForVendor(c, vendor);
                // PK는 뒤에서 복합처리도 하므로 단일 PK만 여기서 표시(복합은 제약으로 처리)
                if (col.primaryKey === true) c = c.primaryKey();
                if (col.unique === true)     c = c.unique();
                if (col.check)      c = c.check(col.check);                                   // 체크 제약조건
                if (vendor === 'mysql' || vendor === 'mariadb') {
                    if (col.unsigned) c = c.unsigned(); // 부호 없는 숫자 (MySQL, MariaDB 전용)
                }
                // 기본값
                c = applyDefault(c, col.defaultValue, vendor) || c;                       // defaultValue 규약 반영   [oai_citation:14‡apply-default.js](file-service://file-LSFSrpHpBxWGcmsNLD1EDw)
                return c;
            });
        }

        function applyAutoIncrementForVendor(columnBuilder, vendorName) {
            const fn = (name) => typeof columnBuilder[name] === 'function'
                ? columnBuilder[name].bind(columnBuilder)
                : null;

            switch ((vendorName || '').toLowerCase()) {
            case 'mssql': {
                const identity = fn('identity');
                if (identity) return identity();
                break;
            }
            case 'postgres': {
                const generatedIdentity = fn('generatedAlwaysAsIdentity');
                if (generatedIdentity) return generatedIdentity();
                break;
            }
            case 'mariadb':
            case 'mysql':
            case 'sqlite': {
                const autoIncrement = fn('autoIncrement');
                if (autoIncrement) return autoIncrement();
                break;
            }
            default:
                break;
            }

            const fallback = fn('autoIncrement');
            return fallback ? fallback() : columnBuilder;
        }

        // 2) 복합 PK/UNIQUE (unique가 string 그룹이면 복합 UNIQUE)
        const pkCols = [];
        // const uniqueSingles = [];
        const uniqueGroups = new Map(); // groupKey -> [col,...]

        for (const [key, col] of this.columns.entries()) {
            const name = (typeof col.name === 'string' && col.name) ? col.name : key;
            if (col.primaryKey === true) pkCols.push(name);

            if (typeof col.unique === 'string' && col.unique.trim()) {
                const g = col.unique.trim();
                if (!uniqueGroups.has(g)) uniqueGroups.set(g, []);
                uniqueGroups.get(g).push(name);
            // } else if (col.unique === true) {
            //     uniqueSingles.push(name);
            }
        }

        if (pkCols.length > 1) {
            tb = tb.addPrimaryKeyConstraint(`pk_${this.tableName}`, pkCols);
        }
        // for (const u of uniqueSingles) {
        //     tb = tb.addUniqueConstraint(`uq_${this.tableName}_${u}`, [u]);
        // }
        for (const [g, cols] of uniqueGroups) {
            tb = tb.addUniqueConstraint(`uq_${this.tableName}_${g}`, cols);
        }

        // 3) (SQLite 한정) FK를 Stage1에서 즉시 포함
        if (vendor === 'sqlite') {
            const fkGroups = this._collectFkGroups(); // Map<groupKey, {name, cols, refTable, refCols, opts}>
            for (const [g, def] of fkGroups) {
                tb = tb.addForeignKeyConstraint(
                def.name || g,
                def.cols,
                def.refTable,
                def.refCols,
                (cb0) => {
                    let cb = cb0;
                    if (def.opts?.onDelete) cb = cb.onDelete(def.opts.onDelete.toLowerCase());
                    if (def.opts?.onUpdate) cb = cb.onUpdate(def.opts.onUpdate.toLowerCase());
                    // match/deferrable 등은 SQLite에서 무시되므로 생략
                    return cb;
                }
                );
            }
        }
        
        // 디버깅
        // const node = tb.toOperationNode();
        // const compiled = db.compiler.compileNode(node);
        // console.log(compiled.sql);
        // console.log(compiled.parameters);
        
        // if (options.execute === true) await tb.execute();
        // return tb.compile();
        return tb;
    }

    /** Stage2: FK (SQLite는 스킵) */
    async _createStage2_FKs(trx, options = { execute: true }) {
        const db = trx || this.db;
        const info = getDbInfo({ db, connect: { dialect: this._connect?.dialect } }) || 
                    await detectAndStoreDbInfo({ db, connect: { dialect: this._connect?.dialect } });
        const vendor = info?.flavor || info?.kind || (this.profile?.vendor ?? 'unknown');
        const sql = [];

        if (vendor === 'sqlite') return sql; // Stage1에서 완료

        // await this._event.emit('creating', { table: this, db, stage: 2, vendor, info });

        const fkGroups = this._collectFkGroups();
        const builders = [];

        for (const [g, def] of fkGroups) {
            let builder = db.schema
                .alterTable(this.tableName)
                .addForeignKeyConstraint(
                def.name || g,
                def.cols,
                def.refTable,
                def.refCols,
                (cb0) => {
                    let cb = cb0;
                    if (def.opts?.onDelete) cb = cb.onDelete(def.opts.onDelete.toLowerCase());
                    if (def.opts?.onUpdate) cb = cb.onUpdate(def.opts.onUpdate.toLowerCase());
                    // match/deferrable: PG 한정. 필요 시 벤더 체크 후 적용.
                    if (def.opts?.match && vendor === 'postgres' && typeof cb.match === 'function') {
                    cb = cb.match(def.opts.match.toLowerCase());
                    }
                    return cb;
                }
                );
            builders.push(builder);
            // sql.push(builder.compile());
            // if (options.execute === true) await builder.execute();            
        }
        return builders;
    }

    /** Stage3: 보조 인덱스 */
    async _createStage3_Indexes(trx, options = { execute: true }) {
        const db = trx || this.db;
        const info = getDbInfo({ db, connect: { dialect: this._connect?.dialect } }) || 
                    await detectAndStoreDbInfo({ db, connect: { dialect: this._connect?.dialect } });
        const vendor = info?.flavor || info?.kind || (this.profile?.vendor ?? 'unknown');
        const sql = [];

        // await this._event.emit('creating', { table: this, db, stage: 3, vendor, info });

        // 컬럼 메타 → 인덱스 그룹 수집(복합/단일 자동 분류)
        const indexDefs = collectIndexGroups(this.tableName, this.columns);          //  [oai_citation:15‡collect-index-group.js](file-service://file-WccUxnsqc1ad5caToyv7ey)
        const builders = [];
        
        for (const idx of indexDefs) {
            let builder = db.schema.createIndex(idx.name).on(this.tableName).columns(idx.columns);
            // UNIQUE 인덱스를 인덱스 레벨에서 만들고 싶으면 확장 가능(현재는 컬럼.unique로 제약을 생성)
            
            // if (options.execute === true) await builder.execute();
            builders.push(builder);
        }
        return builders;
}

    /* ================= 내부 유틸 ================= */

    /** FK 그룹 수집: SQLColumn.references 규약 기반 */
    _collectFkGroups() {
        // references: { target:'users.id', group?:'fk1', name?, onDelete?, onUpdate?, match?, deferrable?, initiallyDeferred? }
        const groups = new Map(); // groupKey -> { name, cols:[], refTable, refCols:[], opts }
        for (const [key, col] of this.columns.entries()) {
        const ref = col.references;
        if (!ref || !ref.target || typeof ref.target !== 'string') continue;

        const colName = (typeof col.name === 'string' && col.name) ? col.name : key;
        const [refTable, refCol] = ref.target.split('.');
        const gk = (ref.group || ref.name || `fk_${this.tableName}_${colName}`).trim();

        if (!groups.has(gk)) {
            groups.set(gk, { name: ref.name, cols: [], refTable, refCols: [], opts: { ...ref } });
        }
        const g = groups.get(gk);
        if (!g.cols.includes(colName)) g.cols.push(colName);
        if (!g.refCols.includes(refCol)) g.refCols.push(refCol);

        // 동일 그룹 내 테이블 불일치 방지
        if (g.refTable !== refTable) {
            throw new Error(`FK group "${gk}" has mixed target tables: ${g.refTable} vs ${refTable}`);
        }
        }
        return groups;
    }

    async drop(trx) {
        const db = trx || this.db;

        // pre-drop event
        await this._event.emit('dropping', { table: this, db: db });

        // await db.schema.dropTable(this.tableName).ifExists().execute();
        const builder = this.$drop(trx); 
        await builder.execute();

        // post-drop event
        await this._event.emit('dropped', { table: this, db: db });
    }

    async insert(p_row, trx) {
        const db = trx || this.db;
        let results = []
        const data = {};
        
        await this._event.emit('inserting', { table: this, db: db });

        // TODO: select 리턴 처리
        // const builders = await this.$insert(db);
        // for (const b of builders) {
        //     const r = await b.execute();
        //     results.push(r);
        // }

        const builder = await this.$insert(p_row, db);
        const sql = builder.compile();
        let result = await builder.executeTakeFirstOrThrow();
        let builder2;
        // features.hasReturning 가 없으면 insertId로 select
        if (result.insertId && (typeof result.insertId === 'number' || typeof result.insertId === 'bigint')) {
            // insertId 가 존재할 경우
            if (result.insertId > 0) {
                const id = this.columns.find(c => c.primaryKey === true && c.autoIncrement === true)?.columnName;
                builder2 = await this.$select({ where: { [id]: result.insertId }, page: 1, size: 1 });
                result = await builder2.executeTakeFirst();
            } else {
                const where = {};
                for (const [k, v] of this.columns.entries()) {
                    if (v.primaryKey === true && p_row[v.columnName] !== undefined ) {
                        where[v.columnName] = p_row[v.columnName];
                    }
                }
                builder2 = await this.$select({ where: where, page: 1, size: 1 });
                result = await builder2.executeTakeFirst();
            }
            console.log('22');
        }

        await this._event.emit('inserted', { table: this, db: db });

        // const LEN = results.length;
        // return results[LEN - 1];
        return result;
    }

    async select(selOpt, trx) {
        const db = trx || this.db;
        // page: 1부터 시작, size: 페이지당 row 수
        const limit = selOpt.size > 0 ? selOpt.size : 10;
        const offset = selOpt.page > 1 ? (selOpt.page - 1) * limit : 0;
        const fill = selOpt.fill === true ? true : false;
        let rows = [];

        if (!db) return rows;

        await this._event.emit('selecting', { table: this, db: db });

        const builder = await this.$select(selOpt, db);
        rows = await builder.execute();

        await this._event.emit('selected', { table: this, db: db });

        if (fill === true) {
            // this.rows.clear();
            rows.forEach(row => {
                this.rows.add(row);
            });
        }

        return rows;
    }

    async update(p_updOpt, trx) {
        const db = trx || this.db;

        await this._event.emit('updating', { table: this, db: db });
        
        const builder = await this.$update(p_updOpt, db);
        const result = await builder.executeTakeFirst();
        
        await this._event.emit('updated', { table: this, db: db });
        return result;
    }

    async delete(p_where, trx) {
        const db = trx || this.db;

        await this._event.emit('deleting', { table: this, db: db });
        
        const builder = await this.$delete(p_where, db);
        const result = await builder.execute();

        await this._event.emit('deleted', { table: this, db: db });
        return result;
    }

    /**
     * @override
     */
    async acceptChanges() {
        const trans = this.rows._transQueue.select();
        const tableName = this._name;

        for (const item of trans) {
            // const pk = 'id';
            // const { [pk]: id, ...changes } = row.ref;
            const row = item.ref;
            if (item.cmd === 'I') {
                await this.insert(row);
                // await this.db.insertInto(tableName).values({ ...changes }).execute();
            } else if (item.cmd === 'U') {
                await this.update(row);
                // await this.db.updateTable(tableName).set({ ...changes }).where('id', '=', id).execute();
            } else if (item.cmd === 'D') {
                await this.delete(row);
                // await this.db.deleteFrom(tableName).where('id', '=', id).execute(); // TODO: 복합 PK 지원
            }
        }
        this.rows.commit();
    }

    async rejectChanges() {
        this.rows.rollback();
        //TODO: DB에서 처리할 지 검토
    }

    async getCreateSQL() {
        const list = [];
        const builders = await this.$create();

        for (const b of builders) {
            const sql = b.compile();
            list.push(sql);
        }
        return list;
    }

    async getDropSQL() {
        const builder = await this.$drop();
        return builder.compile();
    }

    async getInsertSQL(p_row) {
        const builder = await this.$insert(p_row);
        return builder.compile();
    }

    async getSelectSQL(selOpt) {
        const builder = await this.$select(selOpt);
        return builder.compile();
    }

    async getUpdateSQL(p_updOpt) {
        const builder = await this.$update(p_updOpt);
        return builder.compile();
    }

    async getDeleteSQL(p_where) {
        const builder = await this.$delete(p_where);
        return builder.compile();
    }
    
    // ############################################

    $getColumns(p_data, p_type) {
        const data = {};
        const type = p_type || 'all'; // 'pk' | 'data' | 'all'
        
        if (p_data instanceof MetaRow) {
            for (let i = 0; i < p_data.count; i++) {
                const key = p_data.indexToKey(i);
                const col = this.columns[key];
                
                // 컬럼 타입별 필터링
                if (!col || p_data[key] === undefined) continue;
                if (type === 'pk' && (!col.primaryKey || col.virtual)) continue;
                if (type === 'data' && col.virtual) continue;

                data[key] = p_data[key];
            }
        } else if (isObject(p_data)) {
            for (const [key, col] of this.columns.entries()) {
                // 컬럼 타입별 필터링
                if (!col || p_data[key] === undefined) continue;
                if (type === 'pk' && (!col.primaryKey || col.virtual)) continue;
                if (type === 'data' && col.virtual) continue;
                
                data[key] = p_data[key];
            }
        } else {
            throw new Error('Invalid row type');
        }
    
        return data;
    }
    
    deleteBuilder(p_where, p_options) {
        const db = p_options.trx || this.db;
        let pk = {};
        let builder;

        if (p_where instanceof MetaRow) pk = this.$getColumns(p_where, 'pk');
        else if (isObject(p_where)) pk = this.$getColumns(p_where, 'data');
        else throw new Error('Invalid row type');

        if (pk.length === 0) throw new Error('delete: PK 조건이 없어 전체 테이블이 삭제될 수 있습니다.');
        
        builder = db.deleteFrom(this.tableName);
        for (const k in pk) {
            const value = pk[k];
            if (value === undefined) {
                throw new Error(`delete: PK 컬럼 "${k}" 값이 undefined 입니다.`);
            }
            if (Array.isArray(value)) {
                builder = builder.where(k, value[0], value[1]);
                continue;
            }
            builder = builder.where(k, '=', value);
        }

        // pk.forEach((v, k) => {
        //     builder = builder ? builder.where(k, '=', v) : db.deleteFrom(this._name).where(k, '=', v);
        // });

        // const builder = db.deleteFrom(this._name).where(pk);
        return builder;
    }

    async delete_(p_where, p_options) {
        const db   = p_options.trx || this.db;
        const safe = { requireTrx: true, maxDeletableRows: 1, ...p_options };
        const dryRun = safe.dryRun === true ? true : false;

        if (safe.requireTrx && !p_options.trx) {
            throw new Error('delete requires an explicit transaction (requireTrx=true).');
        }

        await this._event.emit('deleting', { table: this, db: db, options: p_options });

        try {
            const builder = this.deleteBuilder(p_where, p_options);
            if (dryRun) {
                await this._event.emit('deleted', { table: this, db: db, options: safe });
                return builder.compile();
            }

            const result = await builder.execute();
            const normalized = this.normalizeDeleteResult(result);

            this.enforceAffectLimit(normalized.affectedRows, safe.maxDeletableRows);
            await this._event.emit('deleted', { table: this, db: db, options: safe });
            return normalized;

        } catch (error) {
            await this._event.emit('deleteError', { table: this, db: db, options: safe, error });
            throw error;
        }
    }

    normalizeDeleteResult(result) {
        // 배열인 경우: 여러 드라이버/트랜잭션 반환 형태 처리
        if (Array.isArray(result)) {
            if (result.length === 0) {
                return { affectedRows: 0, rows: [] };
            }
            const first = result[0];

            // 첫 요소가 DeleteResult/OkPacket 형태인지 확인
            const candidate = first && typeof first === 'object'
                ? (first.numDeletedRows ?? first.affectedRows ?? first.affected_rows ?? null)
                : null;

            if (candidate != null) {
                // bigint일 수 있으므로 숫자로 변환
                const affected = typeof candidate === 'bigint' ? Number(candidate) : Number(candidate);
                return { affectedRows: isNaN(affected) ? 0 : affected, rows: result };
            }

            // 그 외에는 결과 배열을 실제 행 배열로 간주
            return { affectedRows: result.length, rows: result };
        }

        // 단일 객체 형태 처리 (MySQL OkPacket 등)
        if (result && (typeof result.numDeletedRows === 'bigint' || typeof result.numDeletedRows === 'number')) {
            const v = typeof result.numDeletedRows === 'bigint' ? Number(result.numDeletedRows) : result.numDeletedRows;
            return { affectedRows: v };
        }
        if (result && (typeof result.affectedRows === 'bigint' || typeof result.affectedRows === 'number')) {
            const v = typeof result.affectedRows === 'bigint' ? Number(result.affectedRows) : result.affectedRows;
            return { affectedRows: v };
        }

        // 일부 드라이버는 행 배열을 직접 반환하기도 함
        if (Array.isArray(result?.rows)) {
            return { affectedRows: result.rows.length, rows: result.rows };
        }

        return { affectedRows: 0 };
    }
    
    enforceAffectLimit(affected, limit) {
        affected = isNumber(affected) ? Number(affected) : 0;
        limit = isNumber(limit) ? Number(limit) : 0;
        if (limit != null && affected > limit) {
            throw new Error(`affectedRows ${affected} exceeds limit ${limit}.`);
        }
    }
}

function isObject(v) {
    return v && typeof v === 'object' && !Array.isArray(v);
}
function isNumber(v) {
    return (typeof v === 'number') || (typeof v === 'bigint');
}

export default SQLTable;
export { SQLTable };
