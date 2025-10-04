import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import { stoAccountRoutes, menu } from './sto-account.js'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();
const menuMap = [menu];

router.use((req, res, next) => {
  if (typeof res.locals.baseTitle === 'undefined') {
    res.locals.baseTitle = 'Manager'; // TODO: 검토 필요
  }
  res.locals.menuMap = menuMap;
  next();
});

router.use('/', stoAccountRoutes);

export default router;
