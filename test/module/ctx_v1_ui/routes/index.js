import express from 'express';
import * as ctrl from '../../sto-core-ui/controllers/index.js';

const router = express.Router();

// router.get('/', (req, res) => ctrl.list(req, res, { layout: 'layouts/layout2' }));
router.get('/', (req, res) => ctrl.list(req, res, { layout: 'layout2' }));
// router.get('/', ctrl.list);
router.post('/add', ctrl.add);
router.post('/delete/:sto_id', ctrl.del);
router.post('/update/:sto_id', ctrl.update);


export default router;
