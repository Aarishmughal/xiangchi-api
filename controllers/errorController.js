const AppError = require('./../utils/AppError');

const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};
const handleDuplicateFieldsDB = (err) => {
  const match = err.message.match(/(["'])(\\?.)*?\1/);
  const value = match ? match[0] : 'unknown';
  const message = `Duplicate Field Value: ${value}. Please use another value!`;
  return new AppError(message, 400);
};
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Invalid Input Data. ${errors.join('. ')}`;
  return new AppError(message, 400);
};
const handleJWTError = () =>
  new AppError('Invalid Token. Please login Again', 401);
const handleJWTExpiredError = () =>
  new AppError('Your token was expired. Please login again', 401);

const sendErrorDev = (err, req, res) => {
  // A) API
  if (req.originalUrl.startsWith('/api')) {
    return res.status(err.statusCode).json({
      status: err.status,
      error: err,
      message: err.message,
      stack: err.stack,
    });
  }
  // B) RENDERED WEBSITE
  return res.status(err.statusCode).render('error', {
    title: 'Something went wrong!',
    msg: err.message,
  });
};

const sendErrorProd = (err, req, res) => {
  // A) API
  if (req.originalUrl.startsWith('/api')) {
    // OPERATIONAL ERROR, We send message to client
    if (err.isOperational) {
      return new AppError(err.message, err.statusCode);
      // PROGRAMMING ERROR, No Details to client
    }
    // LOGGING FIRST
    console.error('ERROR 💣💣', err);
    // SEND GENERIC MESSAGE
    return new AppError(
      ":( It's not you, it's us. Something went wrong on our end.",
      500
    );
  }
  // B) RENDERED WEBSITE
  if (err.isOperational) {
    res.status(err.statusCode).render('error', {
      title: 'Something went wrong!',
      msg: err.message,
    });
    // PROGRAMMING ERROR, No Details to client
  }
  // LOGGING FIRST
  console.error('ERROR 💣💣', err);
  // SEND GENERIC MESSAGE
  return res.status(err.statusCode).render('error', {
    title: 'Something went wrong!',
    msg: ":( It's not you, it's us. Something went wrong on our end.",
  });
};
module.exports = (err, req, res, next) => {
  // CREATING COPY
  let error = {
    ...err,
    name: err.name,
    message: err.message,
  };
  // DEFAULTING
  error.statusCode = error.statusCode || 500;
  error.status = error.status || 'error';

  // SENDING RESPONSE
  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(error, req, res);
  } else if (process.env.NODE_ENV === 'production') {
    // 1. Invalid ID Error
    if (error.name === 'CastError') error = handleCastErrorDB(error);

    // 2. Duplicate Field Error
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);

    // 3. Validation Error
    if (error.name === 'ValidationError') {
      error = handleValidationErrorDB(error);
    }
    // 4. JWT Invalid Error
    if (error.name === 'JsonWebTokenError') {
      error = handleJWTError();
    }
    // 5. JWT Expired Error
    if (error.name === 'TokenExpiredError') {
      error = handleJWTExpiredError();
    }
    sendErrorProd(error, req, res);
  }
};
