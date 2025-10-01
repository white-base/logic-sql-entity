// app.js
import path from 'path';
import express from 'express';
import { fileURLToPath } from 'url';
import expressLayouts from 'express-ejs-layouts';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import routes, { viewPaths } from './routes/index.js';
import { ctx_v1 } from '../ctx_v1/index.js';
import { SqliteDialect } from 'kysely'
import Database from 'better-sqlite3'
import { sql } from 'kysely'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const connect = {
    dialect: new SqliteDialect({
        database: new Database('mydb-ctx.sqlite')  // 로컬에 파일로 생성
    }),
    log(event) {
      if (event.level === 'query') {
      console.log('SQL:', event.query.sql);
      console.log('Params:', event.query.parameters);
      }
  }
}
ctx_v1.connect = connect;

// 동적 컬럼 추가
// await ctx_v1.addColumn('sto_master', 'add_temp', { dataType: 'varchar(50)' });

await ctx_v1.init();  

// 순서 중요 : 단 sqlite 는 무관함
await sql`DROP TABLE IF EXISTS meb_account`.execute(ctx_v1.db);
await sql`DROP TABLE IF EXISTS sto_account`.execute(ctx_v1.db);
await sql`DROP TABLE IF EXISTS meb_master`.execute(ctx_v1.db);
await sql`DROP TABLE IF EXISTS sto_master`.execute(ctx_v1.db);

await ctx_v1.createSchema();

// 테스트용 데이터 삽입
// await ctx_v1.tables[0].insert({sto_id: 'S001', sto_name: 'Store 1', status_cd: '01'});

// app.use(expressLayouts);
// 뷰 엔진 설정 (EJS 예시)
const app = express();

app.use(expressLayouts);

// app.set('views', [
//   path.join(__dirname, 'views'),
//   path.join(__dirname, '../sto-core-ui/views'),
//   path.join(__dirname, '../sto-addon-account-ui/views')
// ]);
app.set('views', [path.join(__dirname, 'views'), ...viewPaths]);  // POINT: view path 병합
app.set('view engine', 'ejs');
app.set('layout', 'layout');

// 공통 미들웨어
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// 라우터 마운트(모든 feature 라우터는 routes/index.js에서 일괄 관리)
app.use('/', routes);

// 404 처리
// app.use(function(req, res, next) {
//   res.status(404);
//   res.render('home/404', { title: 'Page Not Found' }); // 없으면 res.send('Not Found');
// });

// 500 처리
// app.use(function(err, req, res, next) {
//   console.error(err.stack);
//   res.status(err.status || 500);
//   res.render('home/500', { title: 'Internal Server Error', error: err });
// });

const PORT = process.env.PORT || 3002;

app.listen(PORT, () => {
  console.log(`Express server running: http://localhost:${PORT}`);
});

export default app;
