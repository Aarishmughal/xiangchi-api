const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema(
  {
    roomId: { type: String, unique: true, index: true, required: true },
    players: {
      red: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      black: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    status: {
      type: String,
      enum: ['waiting', 'active', 'finished', 'aborted'],
      default: 'waiting',
    },
    turn: { type: String, enum: ['red', 'black'], default: 'red' },
    board: {
      type: [[String]],
      validate: [
        function (arr) {
          return (
            Array.isArray(arr) &&
            arr.length === 10 &&
            arr.every((r) => Array.isArray(r) && r.length === 9)
          );
        },
        'Board must be 10x9',
      ],
    },
    winner: {
      type: String,
      enum: ['red', 'black', 'draw', null],
      default: null,
    },
    resultReason: { type: String },
    lastActivityAt: { type: Date, default: Date.now },
    startedAt: Date,
    finishedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Game', gameSchema);
