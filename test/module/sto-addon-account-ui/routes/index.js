import express from 'express';
import { stoAccountRoutes, stoAccountMenu, stoAccountViews } from './sto-account.js'

const router = express.Router();
const menuMap = [stoAccountMenu];

router.use((req, res, next) => {
  if (typeof res.locals.baseTitle === 'undefined') {
    res.locals.baseTitle = 'Manager'; // TODO: 검토 필요
  }
  res.locals.menuMap = menuMap;
  next();
});

router.use('/', stoAccountRoutes);

export default router;
export { menuMap, stoAccountViews as viewPaths };