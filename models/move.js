const mongoose = require('mongoose');

const moveSchema = new mongoose.Schema(
  {
    game: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Game',
      required: true,
      index: true,
    },
    moveNumber: {
      type: Number,
      required: true,
    },
    piece: {
      type: String,
      required: true,
      trim: true,
    },
    from: {
      r: { type: Number, required: true, min: 0, max: 9 },
      c: { type: Number, required: true, min: 0, max: 8 },
    },
    to: {
      r: { type: Number, required: true, min: 0, max: 9 },
      c: { type: Number, required: true, min: 0, max: 8 },
    },
    captured: {
      type: String,
      trim: true,
    },
    playedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    color: {
      type: String,
      enum: ['red', 'black'],
      required: true,
    },
    notation: String, // For future algebraic notation
    durationMs: Number, // Time taken to make the move
    isCheck: { type: Boolean, default: false },
    isCheckmate: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Compound index for efficient move retrieval by game and order
moveSchema.index({ game: 1, moveNumber: 1 });

// Virtual to get moves in order for a game
moveSchema.statics.getGameMoves = function (gameId) {
  return this.find({ game: gameId })
    .sort({ moveNumber: 1 })
    .populate('playedBy', 'username email');
};

module.exports = mongoose.model('Move', moveSchema);
