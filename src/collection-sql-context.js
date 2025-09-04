/**** collection-meta-table.js | SQLContextCollection ****/
//==============================================================
import { ExtendError }              from 'logic-entity';
import { Util }                     from 'logic-entity';
import { Type }                     from 'logic-entity';
import { MetaObject }               from 'logic-entity';
import { PropertyCollection }       from 'logic-core';
import { SQLContext }              from './sql-context.js';


class SQLContextCollection extends PropertyCollection {
    /**
     * 메타 테이블 컬렉션
     * @param {object} p_owner 소유자
     */
    constructor(p_owner) {
        super(p_owner);
        
        // let _baseType = MetaTable;
        
        // Object.defineProperty(this, '_baseType', {
        //     get() { return _baseType; },
        //     set(nVal) {
        //         if (!(typeof nVal === 'function')) throw new ExtendError(/EL05421/, null, [this.constructor.name, typeof nVal]);
        //         if (!(Type.isProtoChain(nVal, MetaTable))) throw new ExtendError(/EL05422/, null, [this.constructor.name]);
        //         _baseType = nVal;
        //     },
        //     configurable: false,
        //     enumerable: false
        // });
        
        this._elemTypes = MetaTable;
        this.$KEYWORD = [];
    }

    static _NS = 'Meta.Entity';
    static _PARAMS = ['_owner'];

    /**
     * 테이블 컬렉션에 엔티티 추가
     * @param {string | MetaTable} p_table 추가할 메타테이블
     * @returns {MetaTable} 등록한 아이템
     */
    add(p_key, p_context) {
        
        // if ()
        
        let table, key;
        if (typeof p_table === 'string' && p_table.length > 0) {
            key = p_table;
            table = new this._baseType(key);
            if (this._owner instanceof MetaObject && this._owner.instanceOf('MetaSet')) table._metaSet = this._owner;
        } else if (p_table instanceof MetaTable) {
            key = p_table.tableName;
            table = p_table;
            if (this._owner instanceof MetaObject && this._owner.instanceOf('MetaSet')) p_table._metaSet = this._owner;
        } else throw new ExtendError(/EL05423/, null, [typeof any]);
        if (this.existTableName(key)) throw new ExtendError(/EL05424/, null, [key]);
        return super.add(key, table);
    }

    _hasRecursiveContext(p_ctx) {
        if (!p_ctx) return false;

        // 자기 자신이면 순환
        if (p_ctx === this) return true;

        // 이미 등록된 context 와 같은 참조인지 확인
        for (var i = 0; i < this._list.length; i++) {
            const ctx = this._list[i];
            if (ctx instanceof SQLContext) {
                if (ctx === p_ctx) return true;
                
            }
            if (this._list[i] === p_ctx) return true;

        }

        // context 안에 _list 가 있다면 재귀 탐색
        if (Array.isArray(p_ctx._list)) {
            for (var j = 0; j < p_ctx._list.length; j++) {
                if (this._hasRecursiveContext(p_ctx._list[j])) return true;
            }
        }
        return false;
    };
    /**
     * 테이블명 존재 유무
     * @param {string} p_key 테이블명
     * @returns {boolean}
     */
    existTableName(p_key) {
        for (let i = 0; i < this.count; i++) {
            if (this[i].tableName === p_key) return true;
        }
        return false;
    }
}

// Object.defineProperty(SQLContextCollection.prototype, 'add', {
//     enumerable: false
// });
// Object.defineProperty(SQLContextCollection.prototype, 'existTableName', {
//     enumerable: false
// });

export default SQLContextCollection;
export { SQLContextCollection };