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

        // this._rows        = new SQLRowCollection(this);
        // this._columns     = new MetaTableColumnCollection(this, SQLColumn);
        this.columns._baseType = SQLColumn; // 강제 설정
        this.rows.autoChanges = false;

        this._connect     = null;
        this._db          = null;
        this._profile     = { vendor: null, version: null, features: null }; // { vendor: 'mysql' | 'postgres' | 'sqlite' | 'mssql' }

        this._event       = new EventEmitter();
        
        
        // /**
        //  * 엔티티의 데이터(로우) 컬렉션
        //  * 
        //  * @readonly
        //  * @member {MetaRowCollection} BaseEntity#rows
        //  */
        // Object.defineProperty(this, 'rows', {
        //     get: function() { return this._rows; },
        //     configurable: true,
        //     enumerable: true
        // });

        // /**
        //  * 엔티티의 컬럼 컬렉션
        //  * @readonly
        //  * @member {MetaColumnCollection} BaseEntity#columns
        //  */
        // Object.defineProperty(this, 'columns', {
        //     get: function() { return columns; },
        //     set: function(nVal) { 
        //         if (!(nVal instanceof MetaTableColumnCollection)) throw new ExtendError(/EL05412/, null, []);
        //         if (this.rows.count > 0) throw new ExtendError(/EL05413/, null, [this.constructor.name, this.rows.count]);
        //         columns = nVal;
        //     },
        //     configurable: true,
        //     enumerable: true
        // });
    }


    // get rows() {
    //     return this._rows;
    // }

    // get columns() {
    //     return this._columns;
    // }

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

    async $create(trx) {
        const builders = [];

        builders.push(await this._createStage1(trx));    
        builders.push(...await this._createStage2_FKs(trx));
        builders.push(...await this._createStage3_Indexes(trx));
        // builders.push(await this._createStage1(trx, { execute: false }));
        // builders.push(await this._createStage2_FKs(trx, { execute: false }));
        // builders.push(await this._createStage3_Indexes(trx, { execute: false }));
        // await this._createStage1(trx);
        // await this._createStage2_FKs(trx);
        // await this._createStage3_Indexes(trx);
        return builders;
    }

    async $drop(trx) {
        const db = trx || this.db;
        const builder = db.schema.dropTable(this.tableName).ifExists();
        // 실행은 drop에서, 여기서는 builder만 리턴
        return builder;
    }

    async $insert(p_data, trx) {
        let result = null;
        const data = {};
        let query = null;

        if (p_data instanceof MetaRow) {
            for (let i = 0; i < p_data.count; i++) {
                const key = p_data[i].columnName;
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
        if (this.profile.features?.returning === true) {
            const inserted = await this.db.insertInto(this.tableName)
                .values({ ...data })
                .returningAll()
                .executeTakeFirst();            

        } else {
            const result = await db.insertInto(table)
                .values(values)
                .executeTakeFirstOrThrow();
        }


        try {
            // if (p_row instanceof this.rows._elemTypes || _isObject(p_row)) { TODO: 컬렉션 타입확인필요
            if (p_row instanceof MetaRow || _isObject(p_row)) {
                // this.rows.add(p_row);
                // TODO: p_row 에 대한 검사 필요
                const pk = 'id'
                const { [pk]: id, ...changes } = p_row
                let query = this.db.insertInto(this.tableName).values({ ...changes });
                
                result = query.compile();
                if (options.execute) await query.execute();

                return result;
            } else {
                throw new Error('Invalid row type');
            }

        } catch (err) {
            throw new Error('Invalid row type' + err.message + ', sql:'+ result?.sql);
        }
    }

    async init() {
        const info = await detectAndStoreDbInfo(this);
        this.profile.vendor = info.kind;
        this.profile.version = info.version;
        this.profile.features = await resolveDbFeatures(info.kind, info.version);
    }

    async create(trx) {
        const db = trx || this.db;

        // pre-create event   TODO: 파라메터 정리 필요
        await this._event.emit('creating', { table: this, db: db });

        // await this._createStage1(trx);
        // await this._createStage2_FKs(trx);
        // await this._createStage3_Indexes(trx);

        const builders = await this.$create(db);
        for (const b of builders) {
            await b.execute();
        }
        // post-create event
        await this._event.emit('created', { table: this, db: db });
    }

    // 폐기
    // async _create(trx) {
        
    //     const db = trx || this.db;

    //     // pre-create event   TODO: 파라메터 정리 필요
    //     await this._event.emit('creating', { table: this, db: db });

    //     // table creation
    //     let tableBuilder = db.schema.createTable(this.tableName);
    //     for (const [key, col] of this.columns.entries()) {
    //         const options = normalizeOptions(col);
    //         const name = (typeof col.name === 'string' && col.name) ? col.name : key;
    //         const type = col.dataType || 'text';
    //         tableBuilder = tableBuilder.addColumn(name, type, options);
    //     }
    //     await tableBuilder.execute();


    //     // foreign key creation

    //     // index creation
    //     const indexDefs = collectIndexGroups(this.tableName, this.columns);
    //     for (const indexDef of indexDefs) {
    //         // const isSqlite = this._connect?.dialect?.constructor?.name === 'SqliteDialect';
            
    //         if (this.profile.vendor === 'sqlite') {
    //             await db.schema.createIndex(indexDef.name)
    //                 .on(this.tableName)
    //                 .columns(indexDef.columns)
    //                 .execute();
    //         }
    //     }

    //     // post-create event
    //     await this._event.emit('created', { table: this, db: db });

    //     // inner function
    //     const chainOptionFns = (fns = []) => (col) => fns.reduce((acc, fn) => fn(acc), col);
        
    //     function normalizeOptions(options) {
    //         // if (!options) return undefined;
    //         // if (typeof options === 'function') return options;
    //         // if (Array.isArray(options)) return chainOptionFns(options);
    //         return buildColumnOptionsFromDecl(options);
    //     };

    //     function buildColumnOptionsFromDecl(def = {}) {
    //         return (col) => {
    //             if (def.pk) col = col.primaryKey();
    //             if (def.autoIncrement) col = col.autoIncrement();
    //             if (def.notNull) col = col.notNull();
    //             if (def.unique) col = col.unique();
    //             // if (def.unsigned && typeof col.unsigned === 'function') col = col.unsigned();
    //             // if (def.defaultTo !== undefined) col = col.defaultTo(def.defaultTo);
    //             // if (def.references) {
    //             //     const r = def.references;
    //             //     col = col.references(`${r.table}.${r.column}`);
    //             //     if (r.onDelete) col = col.onDelete(r.onDelete);
    //             //     if (r.onUpdate) col = col.onUpdate(r.onUpdate);
    //             // }
    //             // if (def.check) col = col.check(def.check);
    //             return col;
    //         };
    //     }
    // }

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

    // /** 편의 메서드: 3단계 순차 실행 */
    // async create3Stages(trx) {
    //     await this.createStage1(trx);
    //     await this.createStage2_FKs(trx);
    //     await this.createStage3_Indexes(trx);
    // }

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


    // ============================================
    /**
     * 테이블 생성 및 PK 생성 (내부용)
     */
    // async _createTableWithPK(trx) {
    //     const db = trx || this.db;

    //     // pre-create event
    //     await this._event.emit('creating', { table: this, db: db });

    //     // 테이블 생성
    //     let tableBuilder = db.schema.createTable(this.tableName);
    //     for (const [key, col] of this.columns.entries()) {
    //         const options = (col) => {
    //             let c = col;
    //             if (col.pk) c = c.primaryKey();
    //             if (col.autoIncrement) c = c.autoIncrement();
    //             if (col.notNull) c = c.notNull();
    //             if (col.unique) c = c.unique();
    //             return c;
    //         };
    //         const name = (typeof col.name === 'string' && col.name) ? col.name : key;
    //         const type = col.dataType || 'text';
    //         tableBuilder = tableBuilder.addColumn(name, type, options);
    //     }
    //     await tableBuilder.execute();

    //     // post-create event
    //     await this._event.emit('created', { table: this, db: db });
    // }
    
    // /**
    //  * 외래키(Foreign Key) 제약조건 생성 메서드
    //  * @param {object} trx - 트랜잭션 객체(optional)
    //  */
    // async createForeignKeys(trx) {
    //     const db = trx || this.db;
    //     // TODO: 실제 FK 정의에 따라 구현 필요
    //     // 예시: this.columns에서 FK 정의를 찾아 생성
    //     for (const [key, col] of this.columns.entries()) {
    //         if (col.references) {
    //             const ref = col.references;
    //             await db.schema.alterTable(this.tableName)
    //                 .addForeignKeyConstraint(
    //                     `${this.tableName}_${key}_fk`,
    //                     [col.name || key],
    //                     ref.table,
    //                     [ref.column],
    //                     (builder) => {
    //                         if (ref.onDelete) builder.onDelete(ref.onDelete);
    //                         if (ref.onUpdate) builder.onUpdate(ref.onUpdate);
    //                     }
    //                 )
    //                 .execute();
    //         }
    //     }
    // }
    
    // /**
    //  * 복합(Composite) PK 생성 메서드
    //  * @param {string[]} columns - PK로 지정할 컬럼명 배열
    //  * @param {object} trx - 트랜잭션 객체(optional)
    //  */
    // async createPrimaryKey(columns, trx) {
    //     const db = trx || this.db;
    //     await db.schema.alterTable(this.tableName)
    //         .addPrimaryKeyConstraint(`${this.tableName}_pk`, columns)
    //         .execute();
    // }

    // /**
    //  * FK(외래키) 제약조건 생성 메서드
    //  * @param {Array} foreignKeys - FK 정의 배열 [{ columns, refTable, refColumns, onDelete, onUpdate }]
    //  * @param {object} trx - 트랜잭션 객체(optional)
    //  */
    // async createForeignKeyConstraints(foreignKeys, trx) {
    //     const db = trx || this.db;
    //     for (const fk of foreignKeys) {
    //         await db.schema.alterTable(this.tableName)
    //             .addForeignKeyConstraint(
    //                 `${this.tableName}_${fk.columns.join('_')}_fk`,
    //                 fk.columns,
    //                 fk.refTable,
    //                 fk.refColumns,
    //                 (builder) => {
    //                     if (fk.onDelete) builder.onDelete(fk.onDelete);
    //                     if (fk.onUpdate) builder.onUpdate(fk.onUpdate);
    //                 }
    //             )
    //             .execute();
    //     }
    // }

    // /**
    //  * 인덱스 생성 메서드
    //  * @param {Array} indexes - 인덱스 정의 배열 [{ name, columns, unique }]
    //  * @param {object} trx - 트랜잭션 객체(optional)
    //  */
    // async createIndexDefinitions(indexes, trx) {
    //     const db = trx || this.db;
    //     for (const idx of indexes) {
    //         let builder = db.schema.createIndex(idx.name)
    //             .on(this.tableName)
    //             .columns(idx.columns);
    //         if (idx.unique) builder = builder.unique();
    //         await builder.execute();
    //     }
    // }
    // /**
    //  * 인덱스 생성 메서드
    //  * @param {object} trx - 트랜잭션 객체(optional)
    //  */
    // async createIndexes(trx) {
    //     const db = trx || this.db;
    //     const indexDefs = collectIndexGroups(this.tableName, this.columns);
    //     for (const indexDef of indexDefs) {
    //         if (this.profile.vendor === 'sqlite') {
    //             await db.schema.createIndex(indexDef.name)
    //                 .on(this.tableName)
    //                 .columns(indexDef.columns)
    //                 .execute();
    //         }
    //     }
    // }
    // ============================================



    async drop(trx) {
        const db = trx || this.db;

        // pre-drop event
        await this._event.emit('dropping', { table: this, db: db });

        // await db.schema.dropTable(this.tableName).ifExists().execute();
        await this.$drop(trx).execute();

        // post-drop event
        await this._event.emit('dropped', { table: this, db: db });
    }

    // TODO: select 수정필요, 전달 where 조건 등, page, size 객체로 또는 숫자
    async select(page = 1, size = 10, where = {}) {
        // page: 1부터 시작, size: 페이지당 row 수
        const limit = size > 0 ? size : 10;
        const offset = page > 1 ? (page - 1) * limit : 0;
        let rows = [];

        if (this.connect == null) return rows;

        try {
            let query = this.db
                .selectFrom(this.tableName)
                .selectAll()
                .limit(limit)
                .offset(offset);

            for (const key in where) {
                if (this.columns.existColumnName(key) === false) continue;
                if (Object.prototype.hasOwnProperty.call(where, key)) {
                    query = query.where(key, '=', where[key]);
                }
            }
            rows = await query.execute();

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

    async insert(p_row, options = { execute: true }) {
        let result = null;
        const data = {};
        
        if (this.profile.features?.returning === true) {
            let query = await this.db.insertInto(this.tableName);

            if (p_row instanceof MetaRow) {
                for (let i = 0; i < p_row.count; i++) {
                    const key = p_row[i].columnName;
                    if (this.columns.existColumnName(key)) {
                        data[key] = p_row[key];
                    }
                }

            } else if (_isObject(p_row)) {
                for (const key in p_row) {
                    if (!Object.prototype.hasOwnProperty.call(p_row, key)) continue;
                    if (this.columns.existColumnName(key)) {
                        data[key] = p_row[key];
                    }
                }

            } else {
                throw new Error('Invalid row type');
            }


            query = this.db.insertInto(this.tableName)
                .values({ ...data })
                .returningAll();

            query.executeTakeFirstOrThrow();

            

        }


        try {
            // if (p_row instanceof this.rows._elemTypes || _isObject(p_row)) { TODO: 컬렉션 타입확인필요
            if (p_row instanceof MetaRow || _isObject(p_row)) {
                // this.rows.add(p_row);
                // TODO: p_row 에 대한 검사 필요
                const pk = 'id'
                const { [pk]: id, ...changes } = p_row
                let query = this.db.insertInto(this.tableName).values({ ...changes });
                
                result = query.compile();
                if (options.execute) await query.execute();

                return result;
            } else {
                throw new Error('Invalid row type');
            }

        } catch (err) {
            throw new Error('Invalid row type' + err.message + ', sql:'+ result?.sql);
        }
    }

    // POINT: 여기서 할것
    async update(p_row) {
        const change = {};
        let pkCount = 0; // PK 조건 개수 카운트

        try {
            let query = await this.db.updateTable(this.tableName);

            if (p_row instanceof MetaRow) {
                for (let i = 0; i < p_row.count; i++) {
                    // const key = p_row[i].columnName;
                    const col = this.columns[i];
                    if(col.primaryKey === true) continue; // PK만 조건
                    if(col.virtual === true) continue;  // 가상 컬럼 스킵
                    change[col.columnName] = p_row[i];
                }
            } else if (_isObject(p_row)) {
                for (const key in p_row) {
                    if (!Object.prototype.hasOwnProperty.call(p_row, key)) continue;
                    const col = this.columns[key];
                    if (!col) continue;
                    if (col.primaryKey === true) continue; // PK만 조건
                    if (col.virtual === true) continue;  // 가상 컬럼 스킵
                    change[key] = p_row[key];
                }            
            } else {
                throw new Error('Invalid row type');
            }
            query = query.set(change);

            this.columns.forEach((col, key) => {
                if(col.primaryKey === false) return; // PK만 조건
                if(col.virtual == true) return;  // 가상 컬럼 스킵
                query = query.where(col.columnName, '=', p_row[col.columnName]);
                pkCount++;
            });
            // PK 조건이 없으면 예외 발생
            if (pkCount === 0) {
                throw new Error('update: PK 조건이 없어 전체 테이블이 수정될 수 있습니다.');
            }

            const result = await query.executeTakeFirst();
            return result;

        } catch (err) {
            throw new Error('Invalid row type' + err.message);
        }

        // if (p_row instanceof MetaRow || _isObject(p_row)) {
        //     // const row = p_row instanceof MetaRow ? p_row.entries() : Object.entries(p_row);
            
            
        //     // this.rows.update(p_row);
        //     // return await this.db.updateTable(this.tableName).values(p_row).execute();
        //     // const pk = 'id'
        //     // const { [pk]: id, ...changes } = p_row
        //     // const res = await this.db
        //     //     .updateTable(this.tableName)
        //     //     .set(changes)
        //     //     .where('id', '=', id)
        //     //     .executeTakeFirst()
        //     // return { affectedRows: res.numUpdatedRows ?? 0 }

        //     let query = await this.db.updateTable(this.tableName);
        //     const change = {};

        //     for (let i = 0, key, col; i < row.length; i++) {
        //         const col = row[i];

        //     }
            
        //     for ([key, col] of row) {
        //         if(this.columns?.key.primaryKey === true) continue; // PK만 조건
        //         if(this.columns?.key.virtual === true) continue;  // 가상 컬럼 스킵

        //         change[col.columnName] = p_row[col.columnName];
        //     }
        //     // this.columns.forEach((col, key) => {
        //     //     if(col.primaryKey === true) return; // PK만 조건
        //     //     if(col.virtual !== true) return;  // 가상 컬럼 스킵
        //     //     change[col.columnName] = p_row[col.columnName];
        //     // });
        //     query = query.set(change);

        //     this.columns.forEach((col, key) => {
        //         if(col.primaryKey !== true) return; // PK만 조건
        //         if(col.virtual == true) return;  // 가상 컬럼 스킵
        //         query = query.where(col.columnName, '=', row[col.columnName]);
        //     });
        //     await query.executeTakeFirst();

        // } else {
        //     throw new Error('Invalid row type');
        // }
    }

    async delete(p_row) {
        let pkCount = 0; // PK 조건 개수 카운트

        try {
            if (p_row instanceof MetaRow || _isObject(p_row)) {
                let query = await this.db.deleteFrom(this.tableName);
                
                this.columns.forEach((col, key) => {
                    if(col.primaryKey !== true) return; // PK만 조건
                    if(col.virtual === true) return;  // 가상 컬럼 스킵
                    query = query.where(col.columnName, '=', p_row[col.columnName]);
                    pkCount++;
                });

                // PK 조건이 없으면 예외 발생
                if (pkCount === 0) {
                    throw new Error('delete: PK 조건이 없어 전체 테이블이 삭제될 수 있습니다.');
                }

                await query.executeTakeFirst();
                // return { affectedRows: res.numDeletedRows ?? 0 }

            } else {
                throw new Error('Invalid row type');
            }
        } catch (err) {
            throw new Error('Invalid row type' + err.message);
        }
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

    // async getCreateDDL(trx) {
    //     const sql = [];

    //     sql.push(await this._createStage1(trx, { execute: false })); // 재확인
    //     sql.push(...await this._createStage2_FKs(trx, { execute: false }));
    //     sql.push(...await this._createStage3_Indexes(trx, { execute: false }));
    //     return sql;
    // }

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
}

export default SQLTable;
export { SQLTable };
