import express from 'express';
import { storeRoutes, storeMenu, storeViews } from '../../sto-core-ui/routes/store.js'; // REVIEW: -> '@logicfeel/sto-core-ui/routes'
import { stoAccountRoutes, stoAccountMenu, stoAccountViews } from '../../sto-addon-account-ui/routes/sto-account.js'; // REVIEW: -> '@logicfeel/sto-core-ui/routes'

const router = express.Router();
const menuMap = [];
const layout = 'layout';
const viewPaths = [storeViews, stoAccountViews];  // POINT: view path 정의

storeMenu.basePath = '/sto-core';
menuMap.push(storeMenu);

stoAccountMenu.basePath = '/sto-account';
menuMap.push(stoAccountMenu);

router.use((req, res, next) => {
  if (typeof res.locals.baseTitle === 'undefined') {
    res.locals.baseTitle = 'Manager'; // TODO: 검토 필요
  }
  res.locals.menuMap = menuMap;
  // res.locals.layout = layout;  // 공통 layout 설정
  next();
});

router.get('/', (req, res) => {
    res.render('home');
});

// POINT: 라우터 등록
router.use(storeMenu.basePath, storeRoutes);
router.use(stoAccountMenu.basePath, stoAccountRoutes);

export default router;
export { viewPaths, menuMap }; 
