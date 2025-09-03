/**** sql-column.js | SQLColumn ****/
//==============================================================
import { MetaColumn } from 'logic-entity';

class SQLColumn extends MetaColumn {
    constructor(p_name, p_entity, p_property) {
        super(p_name, p_entity, p_property);

        // SQL
        this._dataType    = '';
        this._length      = 0;
        this._scale       = 0;
        this._nullable    = true;
        this._autoInc     = false;
        this._primaryKey  = false;
        this._isVirtual   = false;
        this._indexes     = [];
        // UI
        this._description = '';
        this._readOnly    = false;
        this._order       = 100;
        this._visible     = true;
    }

    get defaultValue() {
        return this.default;
    }

    get dataType() {
        return this._dataType;
    }

    get length() {
        return this._length;
    }

    get scale() {
        return this._scale;
    }

    get nullable() {
        return this._nullable;
    }

    get autoInc() {
        return this._autoInc;
    }

    get primaryKey() {
        return this._primaryKey;
    }

    get isVirtual() {
        return this._isVirtual;
    }

    get indexes() {
        return this._indexes;
    }

    set indexes(p_indexes) {
        this._indexes = p_indexes;
    }

    get description() {
        return this._description;
    }

    get readOnly() {
        return this._readOnly;
    }

    get order() {
        return this._order;
    }

    get visible() {
        return this._visible;
    }
}


export default SQLColumn;
export { SQLColumn };