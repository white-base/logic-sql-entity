import express from 'express';
import { storeRoutes, storeMenu, storeViews } from './store.js'

const router = express.Router();
const menuMap = [storeMenu];

router.use((req, res, next) => {
  if (typeof res.locals.baseTitle === 'undefined') {
    res.locals.baseTitle = 'Manager'; // TODO: 검토 필요
  }
  res.locals.menuMap = menuMap;
  next();
});

router.use('/', storeRoutes);

export default router;
export { menuMap, storeViews as viewPaths };