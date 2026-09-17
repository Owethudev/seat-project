const app = require('./app');
const config = require('./config/config');

app.listen(config.port, () => {
  console.log(`Ticket reservation API running on port ${config.port}`);
});
