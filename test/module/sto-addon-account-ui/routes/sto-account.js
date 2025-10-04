import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { list, form, add, del, update, detail } from '../controllers/sto-account.controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();
const menu = {
    title: '상점 계정 관리',
    items: [
        { title: '계정 목록', url: '/list' },
        { title: '계정 추가', url: '/form' }
    ],
    basePath: ''
};
const viewPath = path.join(__dirname, '../views');

router.get('/', list);  // default path
router.get('/list', list);
router.get('/form', form);
router.get('/detail/:id', detail);
router.post('/add', add);
router.post('/del/:id', del);
router.post('/update/:id', update);

const stoAccountRoutes = router;

export { stoAccountRoutes, menu, viewPath };