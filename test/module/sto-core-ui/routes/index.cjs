var express = require('express');
var router = express.Router();
var userCtrl = require('../controllers/index.cjs');

router.get('/', userCtrl.index);

module.exports = router;