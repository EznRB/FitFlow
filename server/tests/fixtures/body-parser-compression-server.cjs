const http = require('node:http');
const express = require('express');

// Deliberately isolated from the application, its database and configured ports.
const app = express();
app.use(express.json());
app.post('/', (req, res) => {
  process.send({ parsed: true, id: req.headers['x-fixture-id'] });
  const reply = () => res.json(req.body);
  if (req.complete) reply();
  else {
    req.once('end', reply);
    req.resume();
  }
});
app.use((err, req, res, next) => res.status(err.status || 500).json({ error: err.type }));
const server = http.createServer(app);
server.listen(0, '127.0.0.1', () => process.send({ port: server.address().port }));
process.on('message', (message) => {
  if (message === 'stop') server.close(() => process.exit(0));
});
