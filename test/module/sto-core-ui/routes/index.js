import express from 'express';

// import { index as userIndex } from '../controllers/index.js';
import * as ctrl from '../controllers/index.js';


const router = express.Router();

// router.get('/', userCtrl.index);
// router.get('/', (req, res) => userIndex(req, res, req.query.page, req.query.size));
router.get('/', ctrl.list);


router.post('/add', ctrl.add);

router.post('/delete/:sto_id', ctrl.del);

router.post('/update/:sto_id', ctrl.update);



export default router;
