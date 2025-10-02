const jwt = require('jsonwebtoken');
const { nanoid } = require('nanoid');
const Game = require('../../models/game');
const Move = require('../../models/move');
const User = require('../../models/user');

function opposite(color) {
  return color === 'red' ? 'black' : 'red';
}

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

const xiangqiController = {
  // Maps for tracking active connections
  socketToRoom: new Map(),
  roomSockets: new Map(),

  async handleConnection(socket, io) {
    const user = socket.data.user;
    socket.emit('connect', {
      message: 'Connected to Xiangqi game server',
      authenticated: socket.data.authenticated,
    });

    // Handle creating a new room
    socket.on('create-room', async () => {
      if (!user) {
        return socket.emit('error', 'Authentication required');
      }

      try {
        const roomId = nanoid(8);
        const board = initialBoard();

        const gameDoc = new Game({
          roomId,
          players: { red: user._id, black: null },
          status: 'waiting',
          turn: 'red',
          board,
          startedAt: null,
        });

        await gameDoc.save();

        // Join the room
        socket.join(roomId);
        this.socketToRoom.set(socket.id, roomId);

        // Track sockets in room
        if (!this.roomSockets.has(roomId)) {
          this.roomSockets.set(roomId, new Set());
        }
        this.roomSockets.get(roomId).add(socket.id);

        socket.data.color = 'red';
        socket.data.roomId = roomId;

        socket.emit('room-created', {
          roomId,
          playerColor: 'red',
        });
      } catch (error) {
        socket.emit('error', 'Failed to create room');
      }
    });

    // Handle joining an existing room
    socket.on('join-room', async ({ roomId }) => {
      if (!user) {
        return socket.emit('room-error', 'Authentication required');
      }

      if (!roomId) {
        return socket.emit('room-error', 'Room ID is required');
      }

      try {
        const game = await Game.findOne({ roomId }).populate(
          'players.red players.black',
          'username email'
        );

        if (!game) {
          return socket.emit('room-error', 'Room not found');
        }

        if (game.status !== 'waiting') {
          return socket.emit(
            'room-error',
            'Game has already started or finished'
          );
        }

        if (game.players.black) {
          return socket.emit('room-error', 'Room is already full');
        }

        if (game.players.red.toString() === user._id.toString()) {
          return socket.emit('room-error', 'You cannot join your own room');
        }

        // Add the user as black player
        game.players.black = user._id;
        game.status = 'active';
        game.startedAt = new Date();
        await game.save();

        // Populate after save
        await game.populate('players.red players.black', 'username email');

        // Join the room
        socket.join(roomId);
        this.socketToRoom.set(socket.id, roomId);

        // Track sockets in room
        if (!this.roomSockets.has(roomId)) {
          this.roomSockets.set(roomId, new Set());
        }
        this.roomSockets.get(roomId).add(socket.id);

        socket.data.color = 'black';
        socket.data.roomId = roomId;

        const roomInfo = {
          roomId,
          players: [
            game.players.red._id.toString(),
            game.players.black._id.toString(),
          ],
          currentPlayer: game.turn,
        };

        socket.emit('room-joined', {
          playerId: user._id.toString(),
          playerColor: 'black',
          roomInfo,
        });

        // Notify the red player that someone joined
        socket.to(roomId).emit('player-joined', {
          playerId: user._id.toString(),
          playerColor: 'black',
          roomInfo,
        });
      } catch (error) {
        socket.emit('room-error', 'Failed to join room');
      }
    });

    // Handle leaving a room
    socket.on('leave-room', async ({ roomId }) => {
      if (roomId) {
        socket.leave(roomId);

        // Remove from tracking
        const roomSockets = this.roomSockets.get(roomId);
        if (roomSockets) {
          roomSockets.delete(socket.id);
          if (roomSockets.size === 0) {
            this.roomSockets.delete(roomId);
          }
        }
        this.socketToRoom.delete(socket.id);

        // Notify other players
        socket.to(roomId).emit('player-left', socket.data.user?._id);

        socket.data.color = null;
        socket.data.roomId = null;
      }
    });

    // Handle game moves from frontend
    socket.on('game-move', async ({ roomId, move }) => {
      if (!roomId || !move) {
        return socket.emit('error', 'Invalid move data');
      }

      if (socket.data.roomId !== roomId) {
        return socket.emit('error', 'You are not in this game room');
      }

      const game = await Game.findOne({ roomId });
      if (!game || game.status !== 'active') {
        return socket.emit('error', 'Game is not active');
      }

      // Check if it's the player's turn
      if (game.turn !== socket.data.color) {
        return socket.emit('error', 'It is not your turn');
      }

      try {
        // Get current move number
        const moveCount = await Move.countDocuments({ game: game._id });
        const moveNumber = moveCount + 1;

        // Create new move record
        const newMove = new Move({
          game: game._id,
          moveNumber,
          piece: move.piece.type,
          from: `${move.fromRow},${move.fromCol}`,
          to: `${move.toRow},${move.toCol}`,
          captured: null, // You can implement capture detection here
          playedBy: socket.data.user._id,
          color: socket.data.color,
        });

        await newMove.save();

        // Update game turn and last activity
        game.turn = opposite(game.turn);
        game.lastActivityAt = new Date();
        await game.save();

        // Broadcast move to other players in room (not sender)
        socket.to(roomId).emit('move-received', {
          fromRow: move.fromRow,
          fromCol: move.fromCol,
          toRow: move.toRow,
          toCol: move.toCol,
          piece: move.piece,
          playerId: move.playerId,
        });
      } catch (error) {
        socket.emit('error', 'Failed to process move');
      }
    });

    // Handle resignation
    socket.on('resign_game', async () => {
      const roomId = socket.data.roomId;
      if (!roomId) return;

      const game = await Game.findOne({ roomId });
      if (!game || game.status !== 'active') return;

      game.status = 'finished';
      game.resultReason = 'resign';
      game.winner = socket.data.color === 'red' ? 'black' : 'red';
      game.finishedAt = new Date();
      await game.save();

      io.to(roomId).emit('game_over', {
        reason: 'resign',
        winner: game.winner,
        resignedBy: {
          id: socket.data.user._id,
          username: socket.data.user.username,
        },
      });
    });
  },

  async handleDisconnection(socket) {
    const roomId = this.socketToRoom.get(socket.id);
    if (roomId) {
      // Remove from room tracking
      const roomSockets = this.roomSockets.get(roomId);
      if (roomSockets) {
        roomSockets.delete(socket.id);
        if (roomSockets.size === 0) {
          this.roomSockets.delete(roomId);
        }
      }
      this.socketToRoom.delete(socket.id);

      // Notify other players
      socket.to(roomId).emit('player_disconnected', {
        playerId: socket.data.user?._id,
        username: socket.data.user?.username,
        color: socket.data.color,
      });
    }
  },
};

module.exports = xiangqiController;
