/**** collection-sql-row.js | SQLRowCollection ****/
//==============================================================

import { RowCollection } from 'logic-entity';

class SQLRowCollection extends RowCollection {
  constructor(p_owner) {
    super(p_owner);
  }
}

export default SQLRowCollection;
export { SQLRowCollection };