const express = require('express');
const healthRoutes = require('./routes/healthRoutes');
const holdRoutes = require('./routes/holdRoutes');

const app = express();

app.use(express.json());
app.use('/api', healthRoutes);
app.use('/api', holdRoutes);

module.exports = app;
