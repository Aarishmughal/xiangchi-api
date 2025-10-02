const dotenv = require('dotenv');
const mongoose = require('mongoose');
const http = require('http');
const { Server } = require('socket.io');

// ENV CONFIG
dotenv.config({ path: './config.env' });

// EXPRESS APP
const app = require('./app');

// SOCKET ROUTES
const attachSocketHandlers = require('./routes/socketRoutes');

// HTTP SERVER WRAPPER
const server = http.createServer(app);

// SOCKET.IO INSTANCE
// const allowedOrigins = (
//   process.env.CLIENT_HOSTS ||
//   process.env.CLIENT_HOST ||
//   '*'
// )
//   .split(',')
//   .map((s) => s.trim())
//   .filter(Boolean);
// origin: process.env.CORS_ALLOW_ANY === 'true' ? '*' : allowedOrigins,

const io = new Server(server, {
  cors: {
    origin: true,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Add socket authentication middleware
const { socketAuth } = require('./middleware/socketAuth');
io.use(socketAuth);

attachSocketHandlers(io);

// Attach to app for access in routes if needed
app.set('io', io);

const PORT = process.env.PORT || 3000;
const dbUri = process.env.DATABASE_URI.replace(
  '<DATABASE_PASSWORD>',
  process.env.DATABASE_PASSWORD
);

mongoose.connect(dbUri).then(() => {
  console.log('DATABASE CONNECTION SUCCESSFUL ✅');
  server.listen(PORT, () => {
    console.log(`${PORT}: SERVER IS LISTENING WITH SOCKET.IO 👂`);
  });
});

module.exports = { server, io };
