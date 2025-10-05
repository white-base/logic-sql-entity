import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { list, form, add, del, update, detail } from '../controllers/store.controller.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();
const menu = {
    title: '상점관리',
    items: [
        { title: '상점 목록', url: '/list' },
        { title: '상점 추가', url: '/form' }
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

const storeRoutes = router;
const storeMenu = menu;
const storeViews = viewPath;

export { storeRoutes, storeMenu, storeViews };
