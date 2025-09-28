var express = require('express');
var router = express.Router();
var userCtrl = require('../controllers/index.cjs');

// router.get('/', userCtrl.index);
router.get('/', (req, res) => userCtrl.index(req, res, req.query.page, req.query.size));

module.exports = router;