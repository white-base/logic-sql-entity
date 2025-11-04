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
function isObject(v) {
    return v && typeof v === 'object' && !Array.isArray(v);
}
function isNumber(v) {
    return (typeof v === 'number') || (typeof v === 'bigint');
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
        // this._db = null; // 재생성 유도
        // POINT: connect 변경 시 db 재생성 유도, 오류 발행함 
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

    onCreatedFailed(handler) {
        return this._event.on('createFailed', handler);
    }

    onDropping(handler) {
        return this._event.on('dropping', handler);
    }

    onDropped(handler) {
        return this._event.on('dropped', handler);
    }

    onDropFailed(handler) {
        return this._event.on('dropFailed', handler);
    }

    onInserting(handler) {
        return this._event.on('inserting', handler);
    }

    onInserted(handler) {
        return this._event.on('inserted', handler);
    }

    onInsertFailed(handler) {
        return this._event.on('insertFailed', handler);
    }

    onSelecting(handler) {
        return this._event.on('selecting', handler);
    }

    onSelected(handler) {
        return this._event.on('selected', handler);
    }

    onSelectFailed(handler) {
        return this._event.on('selectFailed', handler);
    }

    onUpdating(handler) {
        return this._event.on('updating', handler);
    }

    onUpdated(handler) {
        return this._event.on('updated', handler);
    }

    onUpdateFailed(handler) {
        return this._event.on('updateFailed', handler);
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

    /* ================= 내부 유틸 ================= */
    $whereBuilder(p_builder, p_where) {
        
        for (const k in p_where) {
            const value = p_where[k];
            if (value === undefined) {
                throw new Error(`컬럼 "${k}" 값이 undefined 입니다.`);
            } else if (Array.isArray(value)) {
                p_builder = p_builder.where(k, value[0], value[1]);
                continue;
            } else if (isObject(value)) {
                for (const opRaw in value) {
                    const v = value[opRaw];
                    if (v === undefined) {
                        throw new Error(`컬럼 "${k}" 값이 undefined 입니다.`);
                    }

                    // 연산자 매핑: '=>' 등을 '>='로 변환 등
                    let op = opRaw;
                    if (opRaw === '=>') op = '>=';   // 사용자가 예시로 준 '=>' 처리
                    if (opRaw === '=<') op = '<=';   // 혹시 사용될 수 있는 표현 처리

                    // 간단한 검증/특수 처리
                    const lop = String(op).toLowerCase();
                    if (lop === 'in') {
                        if (!Array.isArray(v)) {
                            throw new Error(`Operator "in" requires an array value for column "${k}".`);
                        }
                        p_builder = p_builder.where(k, 'in', v);
                    } else if (lop === 'between') {
                        if (!Array.isArray(v) || v.length !== 2) {
                            throw new Error(`Operator "between" requires an array of two values for column "${k}".`);
                        }
                        // REVIEW: between 처리 방법 확인
                        // p_builder = p_builder.where(k, 'between', v);
                        const [min, max] = v;
                        p_builder = p_builder.where(k, '>=', min).where(k, '<=', max);
                    } else if (lop === 'not between') {
                        if (!Array.isArray(v) || v.length !== 2) {
                            throw new Error(`Operator "not between" requires an array of two values for column "${k}".`);
                        }
                        // REVIEW: between 처리 방법 확인
                        const [min, max] = v;
                        p_builder = p_builder.where((eb) => eb(k, '<', min).or(eb(k, '>', max)));  
                    } else {
                        p_builder = p_builder.where(k, op, v);
                    }
                }
                continue;
            }
            p_builder = p_builder.where(k, '=', value);
        }
        return p_builder;
    }

    $orderByBuilder(p_builder, p_orderBy) {
        for (const k in p_orderBy) {
            const value = p_orderBy[k].toLowerCase();
            if (value === 'asc') {
                p_builder = p_builder.orderBy(k, 'asc');
            } else if (value === 'desc') {
                p_builder = p_builder.orderBy(k, 'desc');
            } else {
                throw new Error(`Invalid order value for column "${k}": ${value}`);
            }
        }
        return p_builder;
    }

    $havingBuilder(p_builder, p_having) {
        for (const item of p_having) {
            const { col, op, val } = item;
            if (val === undefined) {
                throw new Error(`컬럼 "${col}" 값이 undefined 입니다.`);
            }
            p_builder = p_builder.having(col, op, val);
        }
        return p_builder;
    }

    $getColumns(p_data, p_type) {
        const data = {};
        const type = p_type || 'all'; // 'pk' | 'data' | 'all', 'set'
        
        if (p_data instanceof MetaRow) {
            for (let i = 0; i < p_data.count; i++) {
                const key = p_data.indexToKey(i);
                const col = this.columns[key];
                
                // 컬럼 타입별 필터링
                if (!col || p_data[key] === undefined) continue;
                if (type === 'pk' && (!col.primaryKey || col.virtual)) continue;
                if (type === 'data' && col.virtual) continue;
                if (type === 'set' && (col.primaryKey || col.virtual)) continue;

                data[key] = p_data[key];
            }
        } else if (isObject(p_data)) {
            for (const [key, col] of this.columns.entries()) {
                // 컬럼 타입별 필터링
                if (!col || p_data[key] === undefined) continue;
                if (type === 'pk' && (!col.primaryKey || col.virtual)) continue;
                if (type === 'data' && col.virtual) continue;
                if (type === 'set' && (col.primaryKey || col.virtual)) continue;
                
                data[key] = p_data[key];
            }
        } else if (Array.isArray(p_data)) {
            p_data.forEach(key => {
                const col = this.columns[key];
                // 컬럼 타입별 필터링
                if (!col) return;
                if (type === 'pk' && (!col.primaryKey || col.virtual)) return;
                if (type === 'data' && col.virtual) return;
                if (type === 'set' && (col.primaryKey || col.virtual)) return;

                data[key] = p_data[key];
            });
        }
    
        return data;
    }

    _enforceAffectLimit(affected, limit) {
        affected = isNumber(affected) ? Number(affected) : 0;
        if (limit == null) return;
        if (!isNumber(limit)) return;
        limit = Number(limit);
        if (affected > limit) {
            throw new Error(`affectedRows ${affected} exceeds limit ${limit}.`);
        }
    }

    _normalizeResult(result) {
        // Extract numeric value from various driver result formats
        const candidates = [
            'numUpdatedRows', 'numInsertedRows', 'numDeletedRows', 
            'numAffectedRows', 'affectedRows', 'affected_rows',
            'changes', 'rowCount', 'count'
        ];

        // Handle array results
        if (Array.isArray(result)) {
            if (result.length === 0) return 0;
            if (result.length === 1) {
                const item = result[0];
                if (!isObject(item)) return 1;
                
                for (const key of candidates) {
                    const value = item[key];
                    if (value != null && (isNumber(value) || typeof value === 'string')) {
                        const num = Number(value);
                        if (!isNaN(num)) return num;
                    }
                }
                return 1;
            }
            return result.length;
        }

        // Handle object results
        if (isObject(result)) {
            for (const key of candidates) {
                const value = result[key];
                if (value != null && (isNumber(value) || typeof value === 'string')) {
                    const num = Number(value);
                    if (!isNaN(num)) return num;
                }
            }
        }

        return 0;
    }

    _getPrimaryKeyColumns() {
        return this.columns.filter(c => c.primaryKey && !c.virtual).map(c => c.columnName);
    }

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

    // ############################################

    async init() {
        const info = await detectAndStoreDbInfo(this);
        this.profile.vendor = info.kind;
        this.profile.version = info.version;
        this.profile.features = resolveDbFeatures(info.kind, info.version);
    }

    /**
     * @override
     */
    async acceptChanges() {
        const trans = this.rows._transQueue.select();
        const tableName = this._name;

        for (const item of trans) {
            const row = item.ref;
            if (item.cmd === 'I') {
                await this.insert(row);
            } else if (item.cmd === 'U') {
                await this.update(row);
            } else if (item.cmd === 'D') {
                await this.delete(row);
            }
        }
        this.rows.commit();
    }

    async rejectChanges() {
        this.rows.rollback();
        //TODO: DB에서 처리할 지 검토
    }

    //  *************** CREATE *********************
    async create(p_options) {
        const db = p_options?.trx || this.db;
        let result = null;

        if (db && typeof db.transaction === 'function' && !p_options?.trx) {
            await db.transaction().execute(async (trx) => {
                result = await this._create({ ...p_options, trx });
            });
        } else {
            result = await this._create({ ...p_options, trx: db });
        }
        return result;
    }

    createBuilders(p_options) {
        const db = p_options.trx || this.db;
        const builders = [];

        builders.push( this.$createStage1(db));
        builders.push(...this.$createStage2_FKs(db));
        builders.push(...this.$createStage3_Indexes(db));
        return builders;
    }    

    async _create(p_options) {
        const db = p_options.trx;
        const safe = { dryRun: false, ...p_options };
        const vendor = this.profile?.vendor || 'unknown';

        await this._event.emit('creating', { table: this, db: db, options: p_options });

        // SQLite: FK 활성화
        if (vendor === 'sqlite') {
            await sql`PRAGMA foreign_keys = ON`.execute(db);
        }

        try {
            const builders = this.createBuilders(p_options);
            if (safe.dryRun === true) {
                await this._event.emit('created', { table: this, db: db, options: safe });
                return builders.map(b => b.compile());
            }

            for (let i = 0; i < builders.length; i++) {
                await builders[i].execute();
            }

            await this._event.emit('created', { table: this, db: db, options: safe });
            return true;

        } catch (error) {
            await this._event.emit('createFailed', { table: this, db: db, options: safe, error });
            throw error;
        }
    }
    
    /* ============================================================
    * 3-Stage DDL: Stage1 → Stage2 → Stage3
    *   Stage1: 테이블 + 컬럼 + (복합)PK + UNIQUE  (+ SQLite는 FK까지)
    *   Stage2: FK (SQLite는 스킵)
    *   Stage3: 보조 인덱스
    * =========================================================== */
   
    /** Stage1: 테이블/컬럼 + PK + UNIQUE (+SQLite는 FK 포함) */
    $createStage1(trx) {
        const db = trx || this.db;
        const vendor = this.profile?.vendor || 'unknown';

        // 테이블 빌드: 컬럼/타입/NULL/기본값/autoInc/PK/UNIQUE
        let tb = db.schema.createTable(this.tableName);

        // 1) addColumn
        for (const [key, col] of this.columns.entries()) {
            const name = (typeof col.name === 'string' && col.name) ? col.name : key;
            const stdType = col.dataType || 'text';
            const vendorType = col?.vendor?.[vendor]?.dataType || convertStandardToVendor(stdType, vendor).toLowerCase(); // 벤더 지정 우선, 없으면 변환   [oai_citation:13‡convert-data-type.js](file-service://file-Qb3v2NGwg15TAUNpa2xSBn)
            // const vendorType = convertStandardToVendor(stdType, vendor).toLowerCase();                // 표준 → 벤더 타입   [oai_citation:13‡convert-data-type.js](file-service://file-Qb3v2NGwg15TAUNpa2xSBn)
            if (col.virtual === true) continue; // 가상 컬럼 스킵

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
        return tb;
    }

    /** Stage2: FK (SQLite는 스킵) */
    $createStage2_FKs(trx) {
        const db = trx || this.db;
        const vendor = this.profile?.vendor || 'unknown';
        const sql = [];

        if (vendor === 'sqlite') return sql; // Stage1에서 완료


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
        }
        return builders;
    }

    /** Stage3: 보조 인덱스 */
    $createStage3_Indexes(trx) {
        const db = trx || this.db;
        const vendor = this.profile?.vendor || 'unknown';
        const sql = [];

        // 컬럼 메타 → 인덱스 그룹 수집(복합/단일 자동 분류)
        const indexDefs = collectIndexGroups(this.tableName, this.columns);          //  [oai_citation:15‡collect-index-group.js](file-service://file-WccUxnsqc1ad5caToyv7ey)
        const builders = [];
        
        for (const idx of indexDefs) {
            let builder = db.schema.createIndex(idx.name).on(this.tableName).columns(idx.columns);
            // UNIQUE 인덱스를 인덱스 레벨에서 만들고 싶으면 확장 가능(현재는 컬럼.unique로 제약을 생성)
            
            builders.push(builder);
        }
        return builders;
}

    //  *************** DROP *********************
    async drop(p_options) {
        const db = p_options?.trx || this.db;
        let result;

        if (db && typeof db.transaction === 'function' && !p_options?.trx) {
            await db.transaction().execute(async (trx) => {
                result = await this._drop({ ...p_options, trx });
            });
        } else {
            result = await this._drop({ ...p_options, trx: db });
        }
        return result;
    }

    dropBuilder(p_options) {
        const db = p_options.trx || this.db;
        const builder = db.schema.dropTable(this.tableName).ifExists();
        return builder;
    }

    async _drop(p_options) {
        const db = p_options?.trx || this.db;
        const safe = { dryRun: false, ...p_options };

        await this._event.emit('dropping', { table: this, db: db, options: p_options });

        try {
            const builder = this.dropBuilder(p_options);
            if (safe.dryRun === true) {
                await this._event.emit('dropped', { table: this, db: db, options: safe });
                return builder.compile();
            }

            await builder.execute();

            await this._event.emit('dropped', { table: this, db: db, options: safe });
            return true;

        } catch (error) {
            await this._event.emit('dropFailed', { table: this, db: db, options: safe, error });
            throw error;
        }        

    }
    
    //  *************** SELECT *********************
    async select(p_select, p_options) {
        const db = p_options?.trx || this.db;
        let result;

        if (db && typeof db.transaction === 'function' && !p_options?.trx) {
            await db.transaction().execute(async (trx) => {
                result = await this._select(p_select, { ...p_options, trx });
            });
        } else {
            result = await this._select(p_select, { ...p_options, trx: db });
        }
        return result;
    }

    selectBuilder(p_select, p_options) {
        const db = p_options.trx || this.db;
        const select = p_select.select || [];
        const distinct = p_select.distinct || false;
        const where = p_select.where || {};
        const orderBy = p_select.orderBy || {}; // { col1: 'asc', col2: 'desc' }
        const groupBy = p_select.groupBy || []; // ['col1', 'col2']
        const having = p_select.having || []; // [ { col: 'col1', op: '=', val: 100 } ]
        const limit = p_select.size > 0 ? p_select.size : 10;
        const offset = p_select.page > 1 ? (p_select.page - 1) * limit : 0;
        const requireOrderBy = this.profile.vendor === 'mssql' ? true : false; // MSSQL은 OFFSET 사용 시 ORDER BY 필수
        let rows = [];
        let builder;
        
        builder = db.selectFrom(this.tableName);
        
        // select
        if ((Array.isArray(select) && select.length > 0 && select[0] !== '*')) {
            builder = builder.select(select);
        } else {
            builder = builder.selectAll();
        }
        
        // distinct
        if (distinct) {
            builder = builder.distinct();
        }
        
        // where
        if (Object.keys(where).length > 0) {
            const whereColumns = this.$getColumns(where, 'all');
            builder = this.$whereBuilder(builder, whereColumns);
        }

        // group by
        if (groupBy.length > 0) {
            builder = builder.groupBy(groupBy);
        }
        // having
        if (having.length > 0) {
            builder = this.$havingBuilder(builder, having);
        }

        // order by
        if (requireOrderBy || Object.keys(orderBy).length > 0) {   // MSSQL은 OFFSET 사용 시 ORDER BY 필수
            if (Object.keys(orderBy).length === 0) {
                const pkColumns = this._getPrimaryKeyColumns();
                pkColumns.forEach(col => {
                    orderBy[col] = 'asc';
                });
            }
            builder = this.$orderByBuilder(builder, orderBy);
        }

        // page, size
        builder = builder.limit(limit).offset(offset);
        return builder;
    }
    
    async _select(p_select, p_options) {
        const db = p_options.trx;
        const safe = { dryRun: false, clearRows: true, ...p_options };

        await this._event.emit('selecting', { table: this, db: db, options: p_options });

        try {
            const builder = this.selectBuilder(p_select, p_options);
            if (safe.dryRun === true) {
                await this._event.emit('selected', { table: this, db: db, options: safe });
                return builder.compile();
            }

            const result = await builder.execute();
            // const normalized = this._normalizeUpdateResult(result);

            if (safe.clearRows === true) {
                this.rows.clear();
            }
            
            // if (safe.fillRows === true) {
            result.forEach(row => {
                this.rows.add(row);
            });
            // }

            // this._enforceAffectLimit(result.length, safe.maxSelectRows);
            await this._event.emit('selected', { table: this, db: db, options: safe });
            return result;

        } catch (error) {
            await this._event.emit('selectFailed', { table: this, db: db, options: safe, error });
            throw error;
        }
    }

    //  *************** INSERT *********************
    async insert(p_data, p_options) {
        const db = p_options?.trx || this.db;
        let result;

        if (db && typeof db.transaction === 'function' && !p_options?.trx) {
            await db.transaction().execute(async (trx) => {
                result = await this._insertAll(trx, p_data, p_options);
            });
        } else {
            result = await this._insertAll(db, p_data, p_options);
        }
        return result;
    }

    insertBuilder(p_data, p_options) {
        const db = p_options.trx || this.db;
        const hasReturning = this.profile.features?.hasReturning || false;
        let data = {};
        let builder;
        
        data = this.$getColumns(p_data, 'data');

        if (Object.keys(data).length === 0) throw new Error('insert: 삽입할 데이터가 없습니다.');

        builder = db.insertInto(this.tableName)
            .values({ ...data });

        if (hasReturning) {
            builder = builder.returningAll();
        }
        return builder;
    }

    async _insertAll(trxOrDb, p_data, p_options) {
        if (Array.isArray(p_data)) {
            const results = [];
            for (const row of p_data) {
                const res = await this._insert(row, { ...p_options, trx: trxOrDb });
                results.push(res);
            }
            return results;
        } else {
            return await this._insert(p_data, { ...p_options, trx: trxOrDb });
        }
    }

    async _insert(p_data, p_options) {
        const db = p_options.trx;
        const safe = { dryRun: false, ...p_options };
        const hasReturning = this.profile.features?.hasReturning;

        await this._event.emit('inserting', { table: this, db: db, options: p_options });

        try {
            const builder = this.insertBuilder(p_data, p_options);

            if (safe.dryRun === true) {
                await this._event.emit('inserted', { table: this, db: db, options: safe });
                return builder.compile();
            }

            const insResult = await builder.executeTakeFirstOrThrow();
            // const normalized = this._normalizeInsertResult(result);

            if (hasReturning === true || insResult.insertId === undefined) {
                if (Object.keys(insResult).length === 0) throw new Error('Insert: 반환된 결과가 없습니다.');
                await this._event.emit('inserted', { table: this, db: db, options: safe });
                return insResult;
            }

            let selResult, selBuilder;
            if (insResult.insertId > 0) {
                const id = this.columns.find(c => c.primaryKey === true && c.autoIncrement === true)?.columnName;
                // TODO: $select 변경
                selBuilder = await this.selectBuilder({ where: { [id]: Number(insResult.insertId) }, page: 1, size: 1 }, p_options);
                selResult = await selBuilder.executeTakeFirst();
                
            } else {
                const where = {};
                for (const [k, v] of this.columns.entries()) {
                    if (v.primaryKey === true && p_row[v.columnName] !== undefined ) {
                        where[v.columnName] = p_row[v.columnName];
                    }
                }
                // TODO: $select 변경
                selBuilder = await this.selectBuilder({ where: { [id]: Number(insResult.insertId) }, page: 1, size: 1 }, p_options);
                // selBuilder = await this._select({ where: where, page: 1, size: 1 }, db);
                selResult = await selBuilder.executeTakeFirst();
            }
            // TODO: 결과 없으면 오류
            // this._enforceAffectLimit(norma`lized.affectedRows, safe.maxDeletableRows);
            if (Object.keys(selResult).length === 0) throw new Error('Insert: 반환된 결과가 없습니다.');

            await this._event.emit('inserted', { table: this, db: db, options: safe });
            
            return selResult;

        } catch (error) {
            await this._event.emit('insertFailed', { table: this, db: db, options: safe, error });
            throw error;
        }
    }

    //  *************** UPDATE *********************
    async update(p_update, p_options) {
        const db = p_options?.trx || this.db;
        let result;

        if (db && typeof db.transaction === 'function' && !p_options?.trx) {
            await db.transaction().execute(async (trx) => {
                result = await this._update(p_update, { ...p_options, trx });
            });
        } else {
            result = await this._update(p_update, { ...p_options, trx: db });
        }
        return result;
    }

    updateBuilder(p_update, p_options) {
        const db = p_options.trx || this.db;
        let set = {};
        let where = {};
        let builder;

        if (p_update instanceof MetaRow || (isObject(p_update) && !isObject(p_update.where) && !isObject(p_update.set))) {
            set = this.$getColumns(p_update, 'set');
            where = this.$getColumns(p_update, 'pk');
        } else if (isObject(p_update) && isObject(p_update.where) && isObject(p_update.set)) {
            set = this.$getColumns(p_update.set, 'all');
            where = this.$getColumns(p_update.where, 'all');
        } else throw new Error('Invalid row type');

        if (Object.keys(where).length === 0) throw new Error('update: WHERE 조건이 없어 전체 테이블이 업데이트될 수 있습니다.');

        builder = db.updateTable(this.tableName).set(set);
        return this.$whereBuilder(builder, where);
    }
    
    async _update(p_update, p_options) {
        const db = p_options.trx;
        const safe = { maxUpdateRows: 1, dryRun: false, ...p_options };

        await this._event.emit('updating', { table: this, db: db, options: p_options });

        try {
            const builder = this.updateBuilder(p_update, p_options);
            if (safe.dryRun === true) {
                await this._event.emit('updated', { table: this, db: db, options: safe });
                return builder.compile();
            }

            const result = await builder.execute();
            const normalized = this._normalizeResult(result);

            this._enforceAffectLimit(normalized, safe.maxUpdateRows);
            await this._event.emit('updated', { table: this, db: db, options: safe });
            return normalized;

        } catch (error) {
            await this._event.emit('updateFailed', { table: this, db: db, options: safe, error });
            throw error;
        }
    }

    //  *************** DELETE *********************
    async delete(p_where, p_options) {
        const db = p_options?.trx || this.db;
        let result;

        if (db && typeof db.transaction === 'function' && !p_options?.trx) {
            await db.transaction().execute(async (trx) => {
                result = await this._delete(p_where, { ...p_options, trx });
            });
        } else {
            result = await this._delete(p_where, { ...p_options, trx: db });
        }
        return result;
    }

    deleteBuilder(p_where, p_options) {
        const db = p_options.trx || this.db;
        let pk = {};
        let builder;

        if (p_where instanceof MetaRow) pk = this.$getColumns(p_where, 'pk');
        else if (isObject(p_where)) pk = this.$getColumns(p_where, 'data');
        else throw new Error('Invalid row type');

        if (Object.keys(pk).length === 0) throw new Error('delete: PK 조건이 없어 전체 테이블이 삭제될 수 있습니다.');
        
        builder = db.deleteFrom(this.tableName);
        return this.$whereBuilder(builder, pk);
    }

    async _delete(p_where, p_options) {
        const db = p_options.trx;
        const safe = { maxDeletableRows: 1, dryRun: false, ...p_options };

        await this._event.emit('deleting', { table: this, db: db, options: p_options });

        try {
            const builder = this.deleteBuilder(p_where, p_options);
            if (safe.dryRun === true) {
                await this._event.emit('deleted', { table: this, db: db, options: safe });
                return builder.compile();
            }

            const result = await builder.execute();
            const normalized = this._normalizeResult(result);

            this._enforceAffectLimit(normalized, safe.maxDeletableRows);
            await this._event.emit('deleted', { table: this, db: db, options: safe });
            return normalized;

        } catch (error) {
            await this._event.emit('deleteFailed', { table: this, db: db, options: safe, error });
            throw error;
        }
    }
}

export default SQLTable;
export { SQLTable };
