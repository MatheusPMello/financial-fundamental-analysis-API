const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const stockRoutes = require('./routes/stockRoutes');

const app = express();

// Middleware
app.use(helmet()); // Security
app.use(cors());   // Allow requests from other domains
app.use(express.json());

// Routes
app.use('/api/stocks', stockRoutes);

module.exports = app;