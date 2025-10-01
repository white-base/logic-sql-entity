import express from 'express';
import { stoRoutes, menu } from './store.js'

const router = express.Router();
const menuMap = [];
const layout = 'layout';

menuMap.push(menu);

router.use((req, res, next) => {
  if (typeof res.locals.baseTitle === 'undefined') {
    res.locals.baseTitle = 'Manager'; // TODO: 검토 필요
  }
  res.locals.menuMap = menuMap;
  res.locals.layout = layout;  // 공통 layout 설정
  next();
});

router.use('/', stoRoutes);

export default router;