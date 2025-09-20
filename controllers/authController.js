const jwt = require('jsonwebtoken');
const { promisify } = require('util');

const User = require('./../models/user');
const AppError = require('./../utils/AppError');
const catchAsync = require('./../utils/catchAsync');

// HELPER FUNCTION(s)
const signAccessToken = (id) =>
  jwt.sign({ id }, process.env.JWT_ACCESS_SECRET, {
    expiresIn: process.env.JWT_ACCESS_EXPIRES_IN,
  });
const signRefreshToken = (id) =>
  jwt.sign({ id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
  });
const decodeToken = async (token) =>
  await promisify(jwt.verify)(token, process.env.JWT_ACCESS_SECRET);

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

  const accessToken = signAccessToken(user._id);
  const refreshToken = signRefreshToken(user._id);

  // Set access token as HTTP-only cookie (optional, or send in body)
  res.cookie('accessToken', accessToken, {
    expires: new Date(Date.now() + 15 * 60 * 1000), // 15 Minutes
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  });

  // Set refresh token as HTTP-only cookie
  res.cookie('refreshToken', refreshToken, {
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  });

  res.status(200).json({
    status: 'success',
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

  const accessToken = signAccessToken(user._id);
  const refreshToken = signRefreshToken(user._id);

  // Set access token as HTTP-only cookie (optional, or send in body)
  res.cookie('accessToken', accessToken, {
    expires: new Date(Date.now() + 15 * 60 * 1000), // 15 Minutes
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
  });

  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });

  res.status(201).json({
    status: 'success',
  });
});

// REFRESH TOKEN METHOD
exports.refreshToken = catchAsync(async (req, res, next) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) {
    return next(new AppError('No refresh token provided', 401));
  }
  let decoded;
  try {
    decoded = await decodeToken(refreshToken);
  } catch (err) {
    return next(new AppError('Invalid refresh token', 401));
  }
  const user = await User.findById(decoded.id);
  if (!user) {
    return next(new AppError('User not found', 401));
  }
  const accessToken = signAccessToken(user._id);
  // res.cookie('jwt', accessToken, {
  //   httpOnly: true,
  //   secure: process.env.NODE_ENV === 'production',
  //   sameSite: 'strict',
  //   expires: new Date(Date.now() + 15 * 60 * 1000), // 15 min
  // });

  res.status(200).json({
    status: 'success',
    token: accessToken,
  });
});

// PROTECT MIDDLEWARE
exports.protect = catchAsync(async (req, res, next) => {
  let accessToken;
  console.log(req.cookies);
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    accessToken = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.accessToken) {
    accessToken = req.cookies.accessToken;
  }

  // Cookie parser is a required middleware for this line of code to work
  if (!accessToken) {
    return next(
      new AppError('You are not logged in! Please log in to get access.', 401)
    );
  }

  const decodedToken = await decodeToken(accessToken);

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
