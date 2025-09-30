const jwt = require('jsonwebtoken');
const { promisify } = require('util');

const User = require('./../models/user');
const AppError = require('./../utils/AppError');
const catchAsync = require('./../utils/catchAsync');

// Cookie/Security config
const baseCookie = {
  httpOnly: true,
  path: '/',
  sameSite: 'none', // cross-site
  secure: true,
};

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
    promisify(jwt.verify)(token, process.env.JWT_ACCESS_SECRET);
  } else {
    promisify(jwt.verify)(token, process.env.JWT_REFRESH_SECRET);
  }
};

const setupCookies = (res, user) => {
  const accessToken = signToken(user._id, 'access');
  const refreshToken = signToken(user._id, 'refresh');
  res.cookie('accessToken', accessToken, {
    ...baseCookie,
    expires: new Date(Date.now() + 15 * 60 * 1000),
  });
  res.cookie('refreshToken', refreshToken, {
    ...baseCookie,
    expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
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

  setupCookies(res, user);

  res.status(200).json({ status: 'success' });
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
  console.log(req.body);

  if (!user) {
    return next(new AppError('User could not be Created', 400));
  }

  setupCookies(res, user);

  res.status(201).json({ status: 'success' });
});

// REFRESH TOKEN METHOD
exports.refreshToken = catchAsync(async (req, res, next) => {
  const { refreshToken } = req.cookies;
  if (!refreshToken) {
    return next(new AppError('No refresh token provided', 401));
  }
  let decoded;
  try {
    decoded = await verifyToken(refreshToken, 'refresh'); // use refresh secret
  } catch (err) {
    return next(new AppError('Invalid refresh token', 401));
  }
  const user = await User.findById(decoded.id);
  if (!user) {
    return next(new AppError('User not found', 401));
  }

  const newAccess = signToken(user._id, 'access');
  res.cookie('accessToken', newAccess, {
    ...baseCookie,
    expires: new Date(Date.now() + 15 * 60 * 1000),
  });

  res.status(200).json({ status: 'success', token: newAccess });
});

// PROTECT MIDDLEWARE
exports.protect = catchAsync(async (req, res, next) => {
  console.log('Cookies:', req.cookies);
  let accessToken;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    accessToken = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.accessToken) {
    accessToken = req.cookies.accessToken;
  }

  if (!accessToken) {
    return next(
      new AppError('You are not logged in! Please log in to get access.', 401)
    );
  }

  const decodedToken = await verifyToken(accessToken, 'access');

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
  res.cookie('accessToken', 'loggedout', {
    ...baseCookie,
    expires: new Date(Date.now() + 10 * 1000),
  });
  res.cookie('refreshToken', 'loggedout', {
    ...baseCookie,
    expires: new Date(Date.now() + 10 * 1000),
  });
  res.status(200).json({ status: 'success' });
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
