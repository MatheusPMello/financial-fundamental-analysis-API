const express = require('express');
const router = express.Router();
const stockController = require('../controllers/stockController');

// GET /api/stocks/analyze/AAPL
router.get('/analyze/:ticker', stockController.analyze);

module.exports = router;