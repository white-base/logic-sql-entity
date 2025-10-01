// app.js
import path from 'path';
import express from 'express';
import { fileURLToPath } from 'url';
import expressLayouts from 'express-ejs-layouts';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import routes from './routes/index.js';
import {ctx_sto_core} from '../sto-core/index.js';
import { SqliteDialect } from 'kysely'
import Database from 'better-sqlite3'
import { sql } from 'kysely'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ctx = ctx_sto_core;
  
ctx.connect = {
    dialect: new SqliteDialect({
        database: new Database('mydb-module.sqlite')  // 로컬에 파일로 생성
    }),
    log(event) {
      if (event.level === 'query') {
      console.log('SQL:', event.query.sql);
      console.log('Params:', event.query.parameters);
      }
  }
};

// 동적 컬럼 추가
await ctx.addColumn('sto_master', 'add_temp', { dataType: 'varchar(50)' });
// DB 초기화 및 스키마 생성
await ctx.init();  
await sql`DROP TABLE IF EXISTS meb_account`.execute(ctx.db);
await sql`DROP TABLE IF EXISTS sto_account`.execute(ctx.db);
await sql`DROP TABLE IF EXISTS meb_master`.execute(ctx.db);
await sql`DROP TABLE IF EXISTS sto_master`.execute(ctx.db);
await ctx.createSchema();
// 테스트용 데이터 삽입
await ctx.tables[0].insert({sto_id: 'S001', sto_name: 'Default Store', status_cd: '01'});

const app = express();

app.use(expressLayouts);
// 뷰 엔진 설정 (EJS 예시)
app.set('views', path.join(__dirname, 'views'));
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

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Express server running: http://localhost:${PORT}`);
});

export default app;
