import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { list, form, add, del, update } from '../controllers/store.controller.js';

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
const layout = 'layout';
const viewPath = path.join(__dirname, '../views');

router.get('/', (req, res) =>
    list(req, res, { layout })
);

router.get('/form', (req, res) =>
    form(req, res, { layout })
);

router.post('/add', (req, res) =>
    add(req, res, { layout })
);

router.post('/del', (req, res) =>
    del(req, res, { layout })
);

router.post('/update', (req, res) =>
    update(req, res, { layout })
);

const stoRoutes = router;

export { stoRoutes, menu, viewPath };
