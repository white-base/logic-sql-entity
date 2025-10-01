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
        { title: '상점 목록', url: '/' },
        { title: '상점 추가', url: '/form' }
    ],
    basePath: ''
};
// const layout = 'layout';
const viewPath = path.join(__dirname, '../views');

router.get('/', (req, res) =>
    list(req, res, { layout: res.locals.layout })
);

router.get('/form', (req, res) =>
    form(req, res, { layout: res.locals.layout })
);

router.get('/detail/:id', (req, res) =>
    detail(req, res, { layout: res.locals.layout })
);

router.post('/add', (req, res) =>
    add(req, res, { layout: res.locals.layout })
);

router.post('/del/:id', (req, res) =>
    del(req, res, { layout: res.locals.layout })
);

router.post('/update/:id', (req, res) =>
    update(req, res, { layout: res.locals.layout })
);

const stoRoutes = router;

export { stoRoutes, menu, viewPath };
