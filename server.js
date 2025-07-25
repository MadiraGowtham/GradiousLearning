const express = require('express');
const jsonServer = require('json-server');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 2000;

// Serve frontend files (HTML, CSS, JS, etc.)
app.use(express.static(path.join(__dirname)));

// Serve videos, materials, images if needed
app.use('/videos', express.static(path.join(__dirname, 'videos')));
app.use('/materials', express.static(path.join(__dirname, 'materials')));
app.use('/images', express.static(path.join(__dirname, 'images')));
// JSON Server
const apiRouter = jsonServer.router('db.json');
const middlewares = jsonServer.defaults();
app.use('/api', middlewares, apiRouter);

// Fallback to index.html if needed
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'HTML', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});