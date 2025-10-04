// app.js
import path from 'path';
import express from 'express';
import { fileURLToPath } from 'url';
import expressLayouts from 'express-ejs-layouts';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import routes, { viewPaths } from './routes/index.js';
import initDatabase from './db/setup.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

initDatabase();  // DB 초기화

app.use(expressLayouts);
app.set('views', [path.join(__dirname, 'views'), ...viewPaths]);
app.set('view engine', 'ejs');
app.set('layout', 'layout');
// 공통 미들웨어
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
// 라우팅
app.use('/', routes);

// 404 처리
app.use(function(req, res, next) {
  res.status(404);
  res.render('404', { title: 'Page Not Found' });
});

// 500 처리
app.use(function(err, req, res, next) {
  console.error(err.stack);
  res.status(err.status || 500);
  res.render('500', { title: 'Internal Server Error', error: err });
});

const PORT = process.env.PORT || 3002;

app.listen(PORT, () => {
  console.log(`Express server running: http://localhost:${PORT}`);
});

export default app;
