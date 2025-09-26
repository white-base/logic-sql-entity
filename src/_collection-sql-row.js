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

    add(p_rows, p_isCheck) {
      const pos = this.$elements.length;

      this.insertAt(pos, p_rows, p_isCheck);
      return pos;
    }

    insertAt(p_index, p_row, p_isCheck) {
      let sqlRow;

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