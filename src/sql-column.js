/**** sql-column.js | SQLColumn ****/
//==============================================================
import { MetaColumn } from 'logic-entity';

class SQLColumn extends MetaColumn {
  constructor(p_name, p_entity, p_property) {
    super(p_name, p_entity, p_property);
  }
}


export default SQLColumn;
export { SQLColumn };