/**** sql-column.js | SQLColumn ****/
//==============================================================
import { MetaColumn, ExtendError } from 'logic-entity';
import { isStandardType } from './util/convert-data-type.js';
import { convertStandardToVendor } from './util/convert-data-type.js';

class SQLColumn extends MetaColumn {
    constructor(p_name, p_entity, p_property) {
        super(p_name, p_entity, p_property);

        // SQL
        this._defaultValue      = null; // 기본값
        this._dataType          = '';
        this._nullable          = true;
        this._primaryKey        = false;
        this._autoIncrement     = false;
        this._references        = null;     // 외래키 참조 { table, column, onUpdate, onDelete }
        this._indexes           = [];
        this._unique            = false;
        this._check             = null;     // 체크 제약조건
        this._unsigned          = false;    // 부호 없는 숫자 MySQL, MariaDB 전용
        this._isDynamic         = true;     // 동적 컬럼 여부 (default: true), 사용자가 직접값을 설정하지 않으면 true
        this._virual          = false;    // 가상 컬럼 여부
        this._vendor            = { 
            mysql: { dataType: '', defaultValue: null }, 
            mariadb: { dataType: '', defaultValue: null }, 
            postgres: { dataType: '', defaultValue: null }, 
            sqlite: { dataType: '', defaultValue: null }, 
            mssql: { dataType: '', defaultValue: null } 
        };  // 벤더별 데이터 타입

        if (p_property) _load(this, p_property);
    }

    /**
     * 기본값 설정
     * @param {object} v 기본값 문자열 또는 객체
     * @param {string} v.kind 기본값 타입 ('literal' | 'now' | 'uuid' | 'json'| 'sql')
     * @param {any} [v.value] kind 가 'literal' 일 때 기본값 (예: 'default text', 0, true, false, { key: 'value' } 등)
     * @param {string} [v.sql] kind 가 'sql' 일 때 SQL 함수 문자열 (예: 'CURRENT_TIMESTAMP')
     */
    get defaultValue() { return this._defaultValue; }
    set defaultValue(v) { this._defaultValue = v; }
    
    /**
     * 표준 데이터 타입 설정  
     * 숫자 타입 : int, bigint, numeric, real, double, boolean  
     * 문자열 타입 : varchar, text  
     * 날짜/시간 타입 : date, time, timestamp, timestamptz  
     * 기타 : binary, varbinary, blob, json, uuid  
     * 
     * @param {string} v 데이터 타입 문자열 (예: 'varchar(255)', 'numeric(10,2)', 'int', 'boolean' 등)
    */
    get dataType() { return this._dataType; }
    set dataType(v) { 
        if (typeof v !== 'string' || v.trim() === '') {
            throw new Error(`Invalid dataType value: ${v}`); // TODO: ExtendError 정의
        }
        // TODO: 임시 제거
        // if (!isStandardType(v)) {
        //     throw new Error(`dataType must be a standard SQL type. Invalid value: ${v}`);   // TODO: ExtendError 정의
        // }
        this._dataType = v; 
    }

    /**
     * 널 허용 설정
     * @param {boolean} v true/false
     */
    get nullable() { return this._nullable; }
    set nullable(v) { 
        if (typeof v !== 'boolean') {
            throw new Error(`Invalid nullable value: ${v}`); // TODO: ExtendError 정의
        }
        this._nullable = !!v;
    }

    /**
     * 기본키 설정
     * @param {boolean} v true/false
     */
    get primaryKey() { return this._primaryKey; }
    set primaryKey(v) { 
        if (typeof v !== 'boolean') {
            throw new Error(`Invalid primaryKey value: ${v}`); // TODO: ExtendError 정의
        }
        this._primaryKey = !!v; 
    }
    /**
     * 기본키 설정 (primaryKey 의 alias)
     */
    get pk () { return this.primaryKey; }
    set pk (v) { this.primaryKey = v; }

    /**
     * 자동 증가 설정 (MySQL, MariaDB, PostgreSQL, SQLite 등에서 지원)
     * @param {boolean} v true/false
     */
    get autoIncrement() { return this._autoIncrement; }
    set autoIncrement(v) { 
        if (typeof v !== 'boolean') {
            throw new Error(`Invalid autoIncrement value: ${v}`); // TODO: ExtendError 정의
        }
        this._autoIncrement = !!v; 
    }
    /**
     * 자동 증가 설정 (autoIncrement 의 alias)
     */
    get identity() { return this.autoIncrement; }
    set identity(v) { this.autoIncrement = v; }

    /**
     * 외래키 참조 설정
     * @param {object | null} v 참조 설정 객체 또는 null
     * @param {string} v.target 참조 대상 테이블 + 컬럼 이름  (예: 'other_table.other_column')
     * @param {string} [v.group] 외래키 그룹 이름 (같은 그룹끼리 묶어서 제약조건 생성)
     * @param {string} [v.name] 외래키 제약조건 이름 (지정하지 않으면 자동 생성)
     * @param {string} [v.onUpdate] ON UPDATE 동작 (예: 'CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION', 'SET DEFAULT')
     * @param {string} [v.onDelete] ON DELETE 동작 (예: 'CASCADE', 'SET NULL', 'RESTRICT', 'NO ACTION', 'SET DEFAULT')
     * @param {string} [v.match] MATCH 옵션, PostgreSQL 전용 (예: 'FULL', 'PARTIAL', 'SIMPLE'), (PG; PARTIAL은 PG 미지원)
     * @param {boolean} [v.deferrable] 제약조건 지연 여부, PostgreSQL 전용 (true: DEFERRABLE, false: NOT DEFERRABLE)
     * @param {boolean} [v.initiallyDeferred] 초기 지연 여부, PostgreSQL 전용 (true: INITIALLY DEFERRED, false: INITIALLY IMMEDIATE)    
    */
    get references() { return this._references; }
    set references(v) {
        let ref = {};

        if (typeof v === 'string' && v.includes('.')) ref.target = v;
        else ref = v;

        if (ref && (typeof ref.target !== 'string' || !ref.target.includes('.'))) {
            throw new Error(`references.target must be in the format 'table.column'. Invalid value: ${ref?.target}`); // TODO: ExtendError 정의
        }
        if (ref !== null && typeof ref !== 'object') {
            throw new Error(`Invalid references value: ${ref}`); // TODO: ExtendError 정의
        }
        if (ref && ref.name && typeof ref.name !== 'string') {
            throw new Error(`references.name must be a string. Invalid value: ${ref?.name}`); // TODO: ExtendError 정의
        }
        if (ref && ref.group && typeof ref.group !== 'string') {
            throw new Error(`references.group must be a string. Invalid value: ${ref?.group}`); // TODO: ExtendError 정의
        }
        if (ref && ref.onUpdate && typeof ref.onUpdate !== 'string') {
            throw new Error(`references.onUpdate must be a string. Invalid value: ${ref?.onUpdate}`); // TODO: ExtendError 정의
        }
        if (ref && ref.onDelete && typeof ref.onDelete !== 'string') {
            throw new Error(`references.onDelete must be a string. Invalid value: ${ref?.onDelete}`);
        }
        if (ref && ref.match && typeof ref.match !== 'string') {
            throw new Error(`references.match must be a string. Invalid value: ${ref?.match}`); // TODO: ExtendError 정의
        }
        if (ref && ref.deferrable !== undefined && typeof ref.deferrable !== 'boolean') {
            throw new Error(`references.deferrable must be a boolean. Invalid value: ${ref?.deferrable}`); // TODO: ExtendError 정의
        }
        if (ref && ref.initiallyDeferred !== undefined && typeof ref.initiallyDeferred !== 'boolean') {
            throw new Error(`references.initiallyDeferred must be a boolean. Invalid value: ${ref?.initiallyDeferred}`);
        }

        this._references = ref;
    }
    /**
     * 외래키 참조 설정 (references 의 alias)
     */
    fk() { return this.references; }
    set fk(v) { this.references = v; }

    /**
     * 인덱스 그룹 설정
     * @param {string | string[] | null} v 인덱스 그룹 키 하나 또는 배열, null/undefined이면 인덱스 없음
    */
    get indexes() { return this._indexes; }
    set indexes(v) { 
        if (Array.isArray(v)) {
            v.some(x => {
                if (typeof x !== 'string' && x !== null && x !== undefined) {
                    throw new Error(`Invalid index value in array: ${x}`); // TODO: ExtendError 정의
                }
                if (typeof x === 'string' && x.trim() === '') {
                    throw new Error(`index string value in array cannot be empty.`); // TODO: ExtendError 정의
                }
            });
            this._indexes = v.slice();
        } else if (v === null || v === undefined) {
            this._indexes = [];
        } else {
            this._indexes = [v];
        }
    }

    /**
     * 고유 제약조건 설정
     * @param {boolean | string} v true/false 또는 고유 제약조건 그룹 키 (같은 그룹끼리 묶어서 제약조건 생성)
    */
    get unique() { return this._unique; }
    set unique(v) {
        if (typeof v !== 'boolean' && typeof v !== 'string') {
            throw new Error(`Invalid unique value: ${v}`); // TODO: ExtendError 정의
        }
        if (typeof v === 'string' && v.trim() === '') {
            throw new Error(`unique string value cannot be empty.`); // TODO: ExtendError 정의
        }
        if (typeof v === 'string') {
            this._unique = v.trim();
            return;
        }
        // boolean
        this._unique = !!v; 
    }

    /**
     * 체크 제약조건 설정  
     * PostgreSQL / SQLite / MSSQL → CHECK 제약조건 정상 동작.  
     * MySQL 8.0.16 그 이전 버전은 무시.  
     * 
     * @param {string | null} v 체크 제약조건 SQL 문자열 또는 null/undefined (제약조건 없음)
    */
    get check() { return this._check; }
    set check(v) { 
        if (v !== null && v !== undefined && typeof v !== 'string') {
            throw new Error(`Invalid check value: ${v}`); // TODO: ExtendError 정의
        }
        if (typeof v === 'string' && v.trim() === '') {
            throw new Error(`check string value cannot be empty.`); // TODO: ExtendError 정의
        }
        this._check = v; 
    }

    /**
     * 부호 없는 숫자 설정 (MySQL, MariaDB 전용)
     */
    get unsigned() { return this._unsigned; }
    set unsigned(v) {
        if (typeof v !== 'boolean') {
            throw new Error(`Invalid unsigned value: ${v}`); // TODO: ExtendError 정의
        }
        this._unsigned = !!v;
    }

    /**
     * 동적 컬럼 설정
     * @param {boolean} v true/false
     */
    get isDynamic() { return this._isDynamic; }
    set isDynamic(v) { 
        if (typeof v !== 'boolean') {
            throw new Error(`Invalid isDynamic value: ${v}`); // TODO: ExtendError 정의
        }
        this._isDynamic = !!v; 
    }

    /**
     * 가상 컬럼 설정
     * @param {boolean} v true/false
     */
    get virtual() { return this._virtual; }
    set virtual(v) {
        if (typeof v !== 'boolean') {
            throw new Error(`Invalid virtual value: ${v}`); // TODO: ExtendError 정의
        }
        this._virtual = !!v;
    }

    /**
     * 벤더별 설정 정보 
     * 
     * @returns {object} { mysql: { dataType, defaultValue }, mariadb: { dataType, defaultValue }, postgres: { dataType, defaultValue }, sqlite: { dataType, defaultValue }, mssql: { dataType, defaultValue } }
     */
    get vendor() { return this._vendor; }
    set vendor(v) {
        if (v !== null && typeof v !== 'object') {
            throw new Error(`Invalid vendor value: ${v}`); // TODO: ExtendError 정의
        }        
        // 기존 구조를 복사하고, v의 값만 덮어쓰기
        const base = { 
            mysql: { dataType: '', defaultValue: null }, 
            mariadb: { dataType: '', defaultValue: null }, 
            postgres: { dataType: '', defaultValue: null }, 
            sqlite: { dataType: '', defaultValue: null }, 
            mssql: { dataType: '', defaultValue: null } 
        };
        if (v) {
            for (const key of Object.keys(base)) {
                if (v[key] && typeof v[key] === 'object') {
                    base[key] = { ...base[key], ...v[key] };
                }
            }
        }
        this._vendor = base;
    }

    // _load(obj) {
    //     super._load(obj);
    //     if (obj.defaultValue !== undefined) this.defaultValue = obj.defaultValue;
    //     if (obj.dataType !== undefined) this.dataType = obj.dataType;
    //     if (obj.nullable !== undefined) this.nullable = obj.nullable;
    //     if (obj.primaryKey !== undefined) this.primaryKey = obj.primaryKey;
    //     if (obj.autoIncrement !== undefined) this.autoIncrement = obj.autoIncrement;
    //     if (obj.references !== undefined) this.references = obj.references;
    //     if (obj.indexes !== undefined) this.indexes = obj.indexes;
    //     if (obj.unique !== undefined) this.unique = obj.unique;
    //     if (obj.check !== undefined) this.check = obj.check;
    //     if (obj.unsigned !== undefined) this.unsigned = obj.unsigned;
    //     if (obj.isDynamic !== undefined) this.isDynamic = obj.isDynamic;
    //     if (obj.virtual !== undefined) this.virtual = obj.virtual;
    //     if (obj.vendor !== undefined) this.vendor = obj.vendor;
    // }

    getVendorType(p_vendor) {
        if (typeof p_vendor !== 'string' || p_vendor.trim() === '') {
            throw new Error(`Invalid vendor value: ${p_vendor}`); // TODO: ExtendError 정의
        }
        const v = p_vendor.trim().toLowerCase();
        if (!['mysql', 'mariadb', 'postgres', 'sqlite', 'mssql'].includes(v)) {
            throw new Error(`Unsupported vendor: ${p_vendor}`); // TODO: ExtendError 정의
        }
        const vendorType = convertStandardToVendor(this.dataType, v);
        return vendorType.toLowerCase();
    }
}

function _load(p_column, p_property) {
    const obj = p_property;

    if (obj.defaultValue !== undefined) p_column.defaultValue = obj.defaultValue;
    if (obj.dataType !== undefined) p_column.dataType = obj.dataType;
    if (obj.nullable !== undefined) p_column.nullable = obj.nullable;
    if (obj.primaryKey !== undefined) p_column.primaryKey = obj.primaryKey;
    if (obj.pk !== undefined) p_column.primaryKey = obj.pk; // alias
    if (obj.autoIncrement !== undefined) p_column.autoIncrement = obj.autoIncrement;
    if (obj.identity !== undefined) p_column.autoIncrement = obj.identity;  // alias
    if (obj.references !== undefined) p_column.references = obj.references;
    if (obj.fk !== undefined) p_column.references = obj.fk; // alias
    if (obj.indexes !== undefined) p_column.indexes = obj.indexes;
    if (obj.unique !== undefined) p_column.unique = obj.unique;
    if (obj.check !== undefined) p_column.check = obj.check;
    if (obj.unsigned !== undefined) p_column.unsigned = obj.unsigned;
    if (obj.isDynamic !== undefined) p_column.isDynamic = obj.isDynamic;
    if (obj.virtual !== undefined) p_column.virtual = obj.virtual;
    if (obj.vendor !== undefined) p_column.vendor = obj.vendor;
}


//==============================================================

export default SQLColumn;
export { SQLColumn };
