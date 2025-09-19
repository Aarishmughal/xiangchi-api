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
        methods: ['GET', 'POST', 'PUT', 'DELETE'], // Allowed HTTP methods
        allowedHeaders: ['Content-Type', 'Authorization'], // Allowed request headers
        credentials: true // Allow cookies or other credentials to be sent
    };

// Middlewares
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}
app.use(express.json());
app.use(cookieParser());
app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/users', userRouter);

// Error Handling Middleware
app.use(/.*/, errorController);

module.exports = app;
