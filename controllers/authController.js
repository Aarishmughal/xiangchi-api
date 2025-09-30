const jwt = require('jsonwebtoken');
const { promisify } = require('util');

const User = require('./../models/user');
const AppError = require('./../utils/AppError');
const catchAsync = require('./../utils/catchAsync');

// HELPER FUNCTION(s)
const signToken = (id, type) => {
  if (type === 'access') {
    return jwt.sign({ id }, process.env.JWT_ACCESS_SECRET, {
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
    });
  }
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  });
};
const verifyToken = (token, type) => {
  if (type === 'access') {
    return promisify(jwt.verify)(token, process.env.JWT_ACCESS_SECRET);
  }
  return promisify(jwt.verify)(token, process.env.JWT_REFRESH_SECRET);
};

// LOGIN METHOD
exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.checkPassword(password, user.password))) {
    return next(new AppError('Incorrect email or password', 401));
  }

  const accessToken = signToken(user._id, 'access');
  const refreshToken = signToken(user._id, 'refresh');

  res.status(200).json({ status: 'success', token: accessToken, refreshToken });
});

// SIGNUP METHOD
exports.signup = catchAsync(async (req, res, next) => {
  const { username, email, password, passwordConfirm } = req.body;
  const user = await User.create({
    username,
    email,
    password,
    passwordConfirm,
  });

  if (!user) {
    return next(new AppError('User could not be Created', 400));
  }

  const accessToken = signToken(user._id, 'access');
  const refreshToken = signToken(user._id, 'refresh');

  res.status(201).json({ status: 'success', token: accessToken, refreshToken });
});

// REFRESH TOKEN METHOD
exports.refreshToken = catchAsync(async (req, res, next) => {
  let refreshToken;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    refreshToken = req.headers.authorization.split(' ')[1];
  }

  if (!refreshToken) {
    return next(new AppError('No refresh token provided', 401));
  }

  let decoded;
  try {
    decoded = await verifyToken(refreshToken, 'refresh');
  } catch (err) {
    return next(new AppError('Invalid or expired refresh token', 401));
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    return next(new AppError('User not found', 401));
  }

  // Check if password was changed after token was issued
  if (user.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError('User recently changed password. Please log in again.', 401)
    );
  }

  const newAccessToken = signToken(user._id, 'access');

  res.status(200).json({
    status: 'success',
    token: newAccessToken,
  });
});

// PROTECT MIDDLEWARE
exports.protect = catchAsync(async (req, res, next) => {
  let accessToken;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    accessToken = req.headers.authorization.split(' ')[1];
  }

  if (!accessToken) {
    return next(
      new AppError('You are not logged in! Please log in to get access.', 401)
    );
  }

  let decodedToken;
  try {
    decodedToken = await verifyToken(accessToken, 'access');
  } catch (err) {
    return next(new AppError('Invalid or expired access token', 401));
  }

  const user = await User.findById(decodedToken.id);
  if (!user) {
    return next(new AppError('User Account not found', 401));
  }

  if (user.changedPasswordAfter(decodedToken.iat)) {
    return next(
      new AppError(
        'User Recently changed their password, Please login again',
        401
      )
    );
  }

  req.user = user;
  next();
});

// LOGOUT METHOD
exports.logout = (req, res) => {
  res
    .status(200)
    .json({ status: 'success', message: 'Logged out successfully' });
};

// RESTRICT TO MIDDLEWARE
exports.restrictTo =
  (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError('You do not have permission to perform this action', 403)
      );
    }
    next();
  };

// TODO:
exports.forgotPassword = catchAsync(async (req, res, next) => {});
exports.resetPassword = catchAsync(async (req, res, next) => {});
exports.updatePassword = catchAsync(async (req, res, next) => {});
