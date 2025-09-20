const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const cookieParser = require('cookie-parser');

// Custom Modules
const userRouter = require('./routes/userRoutes');
const authRouter = require('./routes/authRoutes');
const errorController = require('./controllers/errorController');

const app = express();

const corsOptions = {
  origin: process.env.CLIENT_HOST,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};
app.use(cors(corsOptions));

// Middlewares
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', userRouter);

// Error Handling Middleware
app.use(/.*/, errorController);

module.exports = app;
