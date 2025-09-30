import express from 'express';

// import { index as userIndex } from '../controllers/index.js';
import * as ctrl from '../controllers/index.js';


const router = express.Router();
const menu = { title: '스토어 관리', items: [{ title: '목록', url: '/sto-core' }, { title: '추가', url: '/sto-core/add' }] };

// router.get('/', userCtrl.index);
// router.get('/', (req, res) => userIndex(req, res, req.query.page, req.query.size));
// router.get('/', ctrl.list);
router.get('/', (req, res) => ctrl.list(req, res, { basePath: req.baseUrl || '' }));

router.post('/add', (req, res) => ctrl.add(req, res, { basePath: req.baseUrl || '' }));

router.post('/delete/:sto_id', (req, res) => ctrl.del(req, res, { basePath: req.baseUrl || '' }));

router.post('/update/:sto_id', (req, res) => ctrl.update(req, res, { basePath: req.baseUrl || '' }));

const coreRoutes = router;
export default coreRoutes;
export { menu, coreRoutes };
