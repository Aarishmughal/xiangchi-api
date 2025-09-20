const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const cookieParser = require('cookie-parser');

// Custom Modules
const userRouter = require('./routes/userRoutes');
const authRouter = require('./routes/authRoutes');
const errorController = require('./controllers/errorController');

const app = express();

// Trust proxy is needed when using Secure cookies behind a proxy (e.g., Render, Vercel, Nginx)
app.set('trust proxy', 1);

const allowedOrigins = (
  process.env.CLIENT_HOSTS ||
  process.env.CLIENT_HOST ||
  ''
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true); // allow non-browser tools
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin))
      return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

// Middlewares
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', userRouter);

// Error Handling Middleware
app.use(/.*/, errorController);

module.exports = app;
