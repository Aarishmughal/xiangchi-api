const jwt = require('jsonwebtoken');
const { promisify } = require('util');

const User = require('./../models/user');
const AppError = require('./../utils/AppError');
const catchAsync = require('./../utils/catchAsync');

// HELPER FUNCTION(s)
const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
const decodeToken = async (token) =>
  await promisify(jwt.verify)(token, process.env.JWT_SECRET);

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

  const token = signToken(user._id);
  const cookieExpiresIn =
    process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000 ||
    90 * 24 * 60 * 60 * 1000; // 90 days default
  const cookieOptions = {
    expires: new Date(Date.now() + cookieExpiresIn),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production', // Cookie will only be sent on an encrypted connection (HTTPS) in production
  };
  res.cookie('jwt', token, cookieOptions);
  res.status(200).json({
    status: 'success',
    token,
  });
});

// SIGNUP METHOD
exports.signup = catchAsync(async (req, res, next) => {
  const { username, email, password, passwordConfirm, photo } = req.body;
  const user = await User.create({
    username,
    email,
    password,
    passwordConfirm,
    photo,
  });
  const token = signToken(user._id);
  res.status(201).json({
    status: 'success',
    token,
  });
});

// PROTECT MIDDLEWARE
exports.protect = catchAsync(async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token || !req.cookies.jwt || !req.headers.authorization) {
    return next(
      new AppError('You are not logged in! Please log in to get access.', 401)
    );
  }

  const decodedToken = await decodeToken(token);

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
// FORGOT PASSWORD METHOD: Mail the token
exports.forgotPassword = catchAsync(async (req, res, next) => {});
// RESET PASSWORD METHOD: Update the password via the token from email
exports.resetPassword = catchAsync(async (req, res, next) => {});
// UPDATE PASSWORD METHOD: Update the password when logged in
exports.updatePassword = catchAsync(async (req, res, next) => {});
