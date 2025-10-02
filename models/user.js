const mongoose = require('mongoose');
const validator = require('validator');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

const mmrDefault = 1200;

const userSchema = mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'Username should be atleast 3 characters long'],
      maxlength: [20, 'Username should be atmost 20 characters long'],
    },
    email: {
      type: String,
      required: [true, 'Email Address is required'],
      unique: true,
      trim: true,
      lowercase: true,
      validate: [validator.isEmail, 'Please provide a valid email'],
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    password: {
      type: String,
      required: [true, 'Password cannot be empty'],
      select: false,
      minlength: [8, 'Password should be atleast 8 characters long'],
    },
    passwordConfirm: {
      type: String,
      required: [
        function () {
          return this.isNew || this.isModified('password');
        },
        'Password confirmation is required',
      ],
      validate: {
        validator: function (val) {
          return val === this.password;
        },
        message: 'Passwords do not match',
      },
    },
    passwordChangedAt: Date,
    passwordResetToken: String,
    passwordResetExpires: Date,
    active: {
      type: Boolean,
      default: true,
      // select: false,
    },
    mmr: {
      type: Number,
      default: mmrDefault,
    },
    stats: {
      wins: { type: Number, default: 0 },
      losses: { type: Number, default: 0 },
      draws: { type: Number, default: 0 },
    },
    streak: {
      current: { type: Number, default: 0 },
      max: { type: Number, default: 0 },
    },
    currentGame: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Game',
      default: null,
    },
    // friends: [
    //   {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'User',
    //   },
    // ],
    // blockedUsers: [
    //   {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'User',
    //   },
    // ],
    lastActive: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// INDEXES
userSchema.index({ mmr: -1 });
// userSchema.index({ username: 1 });

// MIDDLEWARES
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  this.passwordConfirm = undefined;
  next();
});

userSchema.pre('save', function (next) {
  if (!this.isModified('password') || this.isNew) return next();
  this.passwordChangedAt = Date.now() - 1000;
  next();
});

// INSTANCE METHODS
userSchema.methods.checkPassword = function (candidatePassword, userPassword) {
  return bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function (jwtIat) {
  if (!this.passwordChangedAt) return false;
  const changed = Math.floor(this.passwordChangedAt.getTime() / 1000);
  return changed > jwtIat;
};

userSchema.methods.createPasswordResetToken = function () {
  const raw = crypto.randomBytes(32).toString('hex');
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(raw)
    .digest('hex');
  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;
  return raw;
};

const User = mongoose.model('User', userSchema);
module.exports = User;
