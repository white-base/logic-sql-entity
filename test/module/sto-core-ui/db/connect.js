import { SqliteDialect } from 'kysely'
import Database from 'better-sqlite3'

const connect = {
    dialect: new SqliteDialect({
        database: new Database('mydb-ctx-3001.sqlite')  // 로컬에 파일로 생성
    }),
    log(event) {
        if (event.level === 'query') {
            console.log('SQL:', event.query.sql);
            console.log('Params:', event.query.parameters);
        }
    }
}

export default connect;