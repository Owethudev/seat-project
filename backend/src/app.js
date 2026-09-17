const express = require('express');
const healthRoutes = require('./routes/healthRoutes');
const holdRoutes = require('./routes/holdRoutes');
const waitlistRoutes = require('./routes/waitlistRoutes');

const app = express();

app.use(express.json());
app.use('/api', healthRoutes);
app.use('/api', holdRoutes);
app.use('/api', waitlistRoutes);

module.exports = app;
