const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const User = require('../models/user');
const AppError = require('../utils/AppError');

// Socket authentication middleware
const socketAuth = async (socket, next) => {
  try {
    // Get token from handshake auth or query
    let token;
    if (socket.handshake.auth && socket.handshake.auth.token) {
      token = socket.handshake.auth.token;
    } else if (socket.handshake.query && socket.handshake.query.token) {
      token = socket.handshake.query.token;
    }

    if (!token) {
      // Allow connection without authentication for now
      // But mark as unauthenticated
      socket.data.user = null;
      socket.data.authenticated = false;
      return next();
    }

    // Verify token
    let decoded;
    try {
      decoded = await promisify(jwt.verify)(
        token,
        process.env.JWT_ACCESS_SECRET
      );
    } catch (err) {
      // Invalid token - allow connection but mark as unauthenticated
      socket.data.user = null;
      socket.data.authenticated = false;
      return next();
    }

    // Check if user still exists
    const user = await User.findById(decoded.id);
    if (!user) {
      socket.data.user = null;
      socket.data.authenticated = false;
      return next();
    }

    // Check if user changed password after token was issued
    if (user.changedPasswordAfter(decoded.iat)) {
      socket.data.user = null;
      socket.data.authenticated = false;
      return next();
    }

    // Grant access
    socket.data.user = user;
    socket.data.authenticated = true;
    next();
  } catch (error) {
    console.error('Socket authentication error:', error);
    socket.data.user = null;
    socket.data.authenticated = false;
    next();
  }
};

// Middleware to require authentication for specific events
const requireAuth = (eventHandler) =>
  async function (...args) {
    const socket = this;

    if (!socket.data.authenticated || !socket.data.user) {
      return socket.emit('error', 'Authentication required');
    }

    return eventHandler.apply(socket, args);
  };

module.exports = {
  socketAuth,
  requireAuth,
};
