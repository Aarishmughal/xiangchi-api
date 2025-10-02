const { nanoid } = require('nanoid');
const Game = require('../models/game');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

// Initial Xiangqi board setup (10x9) Red uppercase, Black lowercase
function initialBoard() {
  return [
    ['R', 'H', 'E', 'A', 'G', 'A', 'E', 'H', 'R'],
    ['.', '.', '.', '.', '.', '.', '.', '.', '.'],
    ['.', 'C', '.', '.', '.', '.', '.', 'C', '.'],
    ['S', '.', 'S', '.', 'S', '.', 'S', '.', 'S'],
    ['.', '.', '.', '.', '.', '.', '.', '.', '.'],
    ['.', '.', '.', '.', '.', '.', '.', '.', '.'],
    ['s', '.', 's', '.', 's', '.', 's', '.', 's'],
    ['.', 'c', '.', '.', '.', '.', '.', 'c', '.'],
    ['.', '.', '.', '.', '.', '.', '.', '.', '.'],
    ['r', 'h', 'e', 'a', 'g', 'a', 'e', 'h', 'r'],
  ];
}

// Helper function to get socket.io instance
function getSocketIO() {
  const app = require('../app');
  return app.get('io');
}

// Create a new game room
exports.createRoom = catchAsync(async (req, res, _next) => {
  const roomId = nanoid(8);
  const board = initialBoard();

  const gameDoc = new Game({
    roomId,
    players: { red: req.user._id, black: null },
    status: 'waiting',
    turn: 'red',
    board,
    startedAt: null,
  });

  await gameDoc.save();

  res.status(201).json({
    status: 'success',
    data: {
      roomId,
      message:
        'Room created successfully. Share this Room ID with another player.',
      game: {
        id: gameDoc._id,
        status: gameDoc.status,
        board: gameDoc.board,
        turn: gameDoc.turn,
      },
    },
  });
});

// Join an existing room
exports.joinRoom = catchAsync(async (req, res, next) => {
  const { roomId } = req.body;

  if (!roomId) {
    return next(new AppError('Room ID is required', 400));
  }

  const game = await Game.findOne({ roomId }).populate(
    'players.red players.black',
    'username email'
  );

  if (!game) {
    return next(new AppError('Room not found', 404));
  }

  if (game.status !== 'waiting') {
    return next(new AppError('Game has already started or finished', 400));
  }

  if (game.players.black) {
    return next(new AppError('Room is already full', 400));
  }

  if (game.players.red.toString() === req.user._id.toString()) {
    return next(new AppError('You cannot join your own room', 400));
  }

  // Add the user as black player
  game.players.black = req.user._id;
  game.status = 'active';
  game.startedAt = new Date();
  await game.save();

  // Populate after save
  await game.populate('players.red players.black', 'username email');

  // Notify via socket if available
  const io = getSocketIO();
  if (io) {
    const roomInfo = {
      roomId,
      players: [
        game.players.red._id.toString(),
        game.players.black._id.toString(),
      ],
      currentPlayer: game.turn,
    };

    io.to(roomId).emit('player-joined', {
      playerId: req.user._id.toString(),
      playerColor: 'black',
      roomInfo,
    });
  }

  res.status(200).json({
    status: 'success',
    data: {
      roomId,
      message: 'Successfully joined the room. Game is starting!',
      game: {
        id: game._id,
        status: game.status,
        board: game.board,
        turn: game.turn,
        players: {
          red: game.players.red,
          black: game.players.black,
        },
      },
    },
  });
});

// Get room information
exports.getRoomInfo = catchAsync(async (req, res, next) => {
  const { roomId } = req.params;

  const game = await Game.findOne({ roomId }).populate(
    'players.red players.black',
    'username email'
  );

  if (!game) {
    return next(new AppError('Room not found', 404));
  }

  // Get moves separately using the Move model
  const Move = require('../models/move');
  const moves = await Move.getGameMoves(game._id);

  res.status(200).json({
    status: 'success',
    data: {
      game: {
        id: game._id,
        roomId: game.roomId,
        status: game.status,
        board: game.board,
        turn: game.turn,
        players: {
          red: game.players.red,
          black: game.players.black,
        },
        createdAt: game.createdAt,
        startedAt: game.startedAt,
        finishedAt: game.finishedAt,
        winner: game.winner,
        resultReason: game.resultReason,
      },
      moves,
      moveCount: moves.length,
    },
  });
});

// Get moves for replay functionality
exports.getGameMoves = catchAsync(async (req, res, next) => {
  const { roomId } = req.params;

  const game = await Game.findOne({ roomId });
  if (!game) {
    return next(new AppError('Game not found', 404));
  }

  const Move = require('../models/move');
  const moves = await Move.getGameMoves(game._id);

  res.status(200).json({
    status: 'success',
    data: {
      gameId: game._id,
      roomId: game.roomId,
      moves,
      moveCount: moves.length,
    },
  });
});
