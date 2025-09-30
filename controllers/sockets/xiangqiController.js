const jwt = require('jsonwebtoken');
const Game = require('../../models/game');
const Move = require('../../models/move');
const User = require('../../models/user');

function opposite(color) {
  return color === 'red' ? 'black' : 'red';
}

const xiangqiController = {
  // Maps for tracking active connections
  socketToRoom: new Map(),
  roomSockets: new Map(),

  async authenticateSocket(socket) {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (token) {
      try {
        const decoded = jwt.verify(
          token,
          process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET
        );
        const user = await User.findById(decoded.id).select(
          '_id username email'
        );
        if (user) {
          socket.data.user = user;
          return user;
        }
      } catch (e) {
        // Invalid token ignored
      }
    }
    return null;
  },

  async handleConnection(socket, io) {
    const user = await this.authenticateSocket(socket);
    socket.emit('xiangqi_connected', {
      message: 'Connected to Xiangqi game server',
      authenticated: !!user,
    });

    // Handle joining a room via socket
    socket.on('join_game_room', async ({ roomId }) => {
      if (!roomId) {
        return socket.emit('error', { message: 'Room ID is required' });
      }

      const game = await Game.findOne({ roomId }).populate(
        'players.red players.black',
        'username email'
      );
      if (!game) {
        return socket.emit('error', { message: 'Room not found' });
      }

      // Check if user is part of this game
      const isRedPlayer =
        game.players.red &&
        game.players.red._id.toString() === user?._id.toString();
      const isBlackPlayer =
        game.players.black &&
        game.players.black._id.toString() === user?._id.toString();

      if (!isRedPlayer && !isBlackPlayer) {
        return socket.emit('error', {
          message: 'You are not part of this game',
        });
      }

      // Join the room
      socket.join(roomId);
      this.socketToRoom.set(socket.id, roomId);

      // Track sockets in room
      if (!this.roomSockets.has(roomId)) {
        this.roomSockets.set(roomId, new Set());
      }
      this.roomSockets.get(roomId).add(socket.id);

      socket.data.color = isRedPlayer ? 'red' : 'black';
      socket.data.roomId = roomId;

      socket.emit('joined_game_room', {
        roomId,
        color: socket.data.color,
        game: {
          status: game.status,
          board: game.board,
          turn: game.turn,
          players: game.players,
        },
      });

      // Notify other players in room
      socket.to(roomId).emit('player_joined', {
        playerId: user._id,
        username: user.username,
        color: socket.data.color,
      });
    });

    // Handle game moves - no validation, client sends piece name and coordinates
    socket.on('make_move', async ({ piece, from, to, captured }) => {
      const roomId = socket.data.roomId;
      if (!roomId) {
        return socket.emit('error', { message: 'You are not in a game room' });
      }

      const game = await Game.findOne({ roomId });
      if (!game || game.status !== 'active') {
        return socket.emit('error', { message: 'Game is not active' });
      }

      const color = socket.data.color;

      // Get current move number
      const moveCount = await Move.countDocuments({ game: game._id });
      const moveNumber = moveCount + 1;

      // Create new move record
      const newMove = new Move({
        game: game._id,
        moveNumber,
        piece,
        from,
        to,
        captured: captured || null,
        playedBy: socket.data.user._id,
        color,
      });

      await newMove.save();

      // Update game turn and last activity
      game.turn = opposite(game.turn);
      game.lastActivityAt = new Date();
      await game.save();

      // Populate the move for broadcasting
      await newMove.populate('playedBy', 'username email');

      // Broadcast move to all players in room
      io.to(roomId).emit('move_made', {
        move: {
          id: newMove._id,
          piece: newMove.piece,
          from: newMove.from,
          to: newMove.to,
          captured: newMove.captured,
          moveNumber: newMove.moveNumber,
          playedBy: newMove.playedBy,
          color: newMove.color,
          createdAt: newMove.createdAt,
        },
        turn: game.turn,
        moveNumber,
      });
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
