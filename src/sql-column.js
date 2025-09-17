/**** sql-column.js | SQLColumn ****/
//==============================================================
import { MetaColumn } from 'logic-entity';
import { isStandardType } from './util/convert-data-type.js';

class SQLColumn extends MetaColumn {
    constructor(p_name, p_entity, p_property) {
        super(p_name, p_entity, p_property);

        // SQL
        this._defaultValue = null; // 기본값
        this._dataType      = '';
        this._nullable      = true;
        this._primaryKey    = false;
        this._autoIncrement = false;
        this._references    = null;     // 외래키 참조 { table, column, onUpdate, onDelete }
        this._indexes       = [];
        this._unique        = false;
        this._check         = null;     // 체크 제약조건
        this._unsigned      = false;    // 부호 없는 숫자 MySQL, MariaDB 전용
        this._isDynamic     = true;     // 동적 컬럼 여부 (default: true), 사용자가 직접값을 설정하지 않으면 true
        this._virtual       = false;    // 가상 컬럼 여부


        if (p_property) this._load(p_property);
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
        if (!isStandardType(v)) {
            throw new Error(`dataType must be a standard SQL type. Invalid value: ${v}`);   // TODO: ExtendError 정의
        }
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
        if (v !== null && typeof v !== 'object') {
            throw new Error(`Invalid references value: ${v}`); // TODO: ExtendError 정의
        }
        if (v && (typeof v.target !== 'string' || !v.target.includes('.'))) {
            throw new Error(`references.target must be in the format 'table.column'. Invalid value: ${v?.target}`); // TODO: ExtendError 정의
        }
        if (v && v.name && typeof v.name !== 'string') {
            throw new Error(`references.name must be a string. Invalid value: ${v?.name}`); // TODO: ExtendError 정의
        }
        if (v && v.group && typeof v.group !== 'string') {
            throw new Error(`references.group must be a string. Invalid value: ${v?.group}`); // TODO: ExtendError 정의
        }
        if (v && v.onUpdate && typeof v.onUpdate !== 'string') {
            throw new Error(`references.onUpdate must be a string. Invalid value: ${v?.onUpdate}`); // TODO: ExtendError 정의
        }
        if (v && v.onDelete && typeof v.onDelete !== 'string') {
            throw new Error(`references.onDelete must be a string. Invalid value: ${v?.onDelete}`); // TODO: ExtendError 정의
        }
        if (v && v.match && typeof v.match !== 'string') {
            throw new Error(`references.match must be a string. Invalid value: ${v?.match}`); // TODO: ExtendError 정의
        }
        if (v && v.deferrable !== undefined && typeof v.deferrable !== 'boolean') {
            throw new Error(`references.deferrable must be a boolean. Invalid value: ${v?.deferrable}`); // TODO: ExtendError 정의
        }
        if (v && v.initiallyDeferred !== undefined && typeof v.initiallyDeferred !== 'boolean') {
            throw new Error(`references.initiallyDeferred must be a boolean. Invalid value: ${v?.initiallyDeferred}`); // TODO: ExtendError 정의
        }   
        this._references = v;
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

    _load(obj) {
        super._load(obj);
        if (obj.defaultValue !== undefined) this.defaultValue = obj.defaultValue;
        if (obj.dataType !== undefined) this.dataType = obj.dataType;
        if (obj.nullable !== undefined) this.nullable = obj.nullable;
        if (obj.primaryKey !== undefined) this.primaryKey = obj.primaryKey;
        if (obj.autoIncrement !== undefined) this.autoIncrement = obj.autoIncrement;
        if (obj.references !== undefined) this.references = obj.references;
        if (obj.indexes !== undefined) this.indexes = obj.indexes;
        if (obj.unique !== undefined) this.unique = obj.unique;
        if (obj.check !== undefined) this.check = obj.check;
        if (obj.unsigned !== undefined) this.unsigned = obj.unsigned;
        if (obj.isDynamic !== undefined) this.isDynamic = obj.isDynamic;
        if (obj.virtual !== undefined) this.virtual = obj.virtual;
    }
}


//==============================================================

export default SQLColumn;
export { SQLColumn };