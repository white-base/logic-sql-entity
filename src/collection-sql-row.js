/**** collection-sql-row.js | SQLRowCollection ****/
//==============================================================
import { MetaRowCollection } from 'logic-entity';
import { SQLRow }            from './sql-row.js';

// local funciton
function _isObject(obj) {    // 객체 여부
    if (typeof obj === 'object' && obj !== null) return true;
    return false;
}

class SQLRowCollection extends MetaRowCollection {
    constructor(p_owner) {
        super(p_owner);

        this._elemTypes = SQLRow;   // 컬렉션타입 설정
        this.autoChanges = false;
    }

    // _getPropDescriptor(p_idx) {
    //   return {
    //         get: function() { return this.$elements[p_idx]; },
    //         set: function(nVal) {
    //             // if (this._elemTypes.length > 0) Type.matchType([this._elemTypes], nVal);
    //             if (nVal._entity !== this._owner) throw new ExtendError(/EL05221/, null, [this.constructor.name]);
    //             this._transQueue.update(p_idx, nVal, this.$elements[p_idx]); 
    //             this.$elements[p_idx] = nVal;
    //         },
    //         configurable: true,
    //         enumerable: true,
    //     };
    // }

    add(p_rows, p_isCheck) {
      // var sqlRow;

      // if (p_rows instanceof SQLRow) {
      //     sqlRow = p_rows;
      // } else if (_isObject(p_rows)) {
      //     sqlRow = new SQLRow(this._owner);
      //     for (const key in p_rows) {
      //         if (Object.prototype.hasOwnProperty.call(p_rows, key)) {
      //             sqlRow[key] = p_rows[key];
      //         }
      //     }
      // }

      var pos = this.$elements.length;
      this.insertAt(pos, p_rows, p_isCheck);
      return pos;
    }

    insertAt(p_index, p_row, p_isCheck) {
      var sqlRow;

      if (p_row instanceof SQLRow) {
          sqlRow = p_row;
      } else if (_isObject(p_row)) {
          sqlRow = new SQLRow(this._owner);
          for (const key in p_row) {
              if (Object.prototype.hasOwnProperty.call(p_row, key)) {
                  sqlRow[key] = p_row[key];
              }
          }
      }
      super.insertAt(p_index, sqlRow, p_isCheck);
    }
}



export default SQLRowCollection;
export { SQLRowCollection };