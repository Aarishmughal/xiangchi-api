const express = require('express');
const gameController = require('../controllers/gameController');
const authController = require('../controllers/authController');

const router = express.Router();

// All game routes require authentication
router.use(authController.protect);

// POST /api/v1/games/create-room - Create a new game room
router.post('/create-room', gameController.createRoom);

// POST /api/v1/games/join-room - Join an existing room
router.post('/join-room', gameController.joinRoom);

// GET /api/v1/games/room/:roomId - Get room information
router.get('/room/:roomId', gameController.getRoomInfo);

// GET /api/v1/games/room/:roomId/moves - Get game moves for replay
router.get('/room/:roomId/moves', gameController.getGameMoves);

module.exports = router;
