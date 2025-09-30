import express from 'express';
import * as ctrl from '../../sto-core-ui/controllers/index.js';
import coreRoutes from '../../sto-core-ui/routes/index.js';

const router = express.Router();

router.use((req, res, next) => {
  if (typeof res.locals.title === 'undefined') {
    res.locals.title = '기본 제목';
  }
  next();
});

// router.get('/', (req, res) => ctrl.list(req, res, { layout: 'layouts/layout2' }));
router.get('/', (req, res) => {
    res.render('home', { layout: 'layout2' });
});

// router.get('/', ctrl.list);
// router.get('/sto-core', (req, res) => ctrl.list(req, res, { layout: 'layout2', basePath: '/sto-core' }));
// router.post('/sto-core/add', (req, res) => ctrl.add(req, res, { basePath: '/sto-core' }));
// router.post('/sto-core/delete/:sto_id', (req, res) => ctrl.del(req, res, { basePath: '/sto-core' }));
// router.post('/sto-core/update/:sto_id', (req, res) => ctrl.update(req, res, { basePath: '/sto-core' }));

router.use('/sto-core', coreRoutes); // /sto-core 경로로 마운트

export default router;
