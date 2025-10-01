import express from 'express';
// import * as ctrl from '../../sto-core-ui/controllers/index.js';
import { menu as stoMenu, stoRoutes, viewPath as stoViewPath } from '../../sto-core-ui/routes/store.js'; // REVIEW: -> '@logicfeel/sto-core-ui/routes'
import { menu as stoAccountMenu, stoAccountRoutes, viewPath as accoutViewPath } from '../../sto-addon-account-ui/routes/sto-account.js'; // REVIEW: -> '@logicfeel/sto-core-ui/routes'


const router = express.Router();
const menuMap = [];
const layout = 'layout';
const viewPaths = [stoViewPath, accoutViewPath];

stoMenu.basePath = '/sto-core';
menuMap.push(stoMenu);

stoAccountMenu.basePath = '/sto-account';
menuMap.push(stoAccountMenu);

router.use((req, res, next) => {
  if (typeof res.locals.baseTitle === 'undefined') {
    res.locals.baseTitle = 'Manager'; // TODO: 검토 필요
  }
  res.locals.menuMap = menuMap;
  next();
});

router.get('/', (req, res) => {
    res.render('home', { layout });
});

router.use(stoMenu.basePath, stoRoutes);
router.use(stoAccountMenu.basePath, stoAccountRoutes);

export default router;
export { viewPaths }; 
