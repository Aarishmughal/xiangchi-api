const chatController = require('../controllers/sockets/chatController');
const xiangqiController = require('../controllers/sockets/xiangqiController');

const attachSocketHandlers = (io) => {
  io.on('connection', async (socket) => {
    // Handle different types of socket connections
    console.log('Socket connected:', socket.id);

    // Initialize all controllers
    await xiangqiController.handleConnection(socket, io);
    chatController.handleConnection(socket, io);

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log('Socket disconnected:', socket.id);
      xiangqiController.handleDisconnection(socket);
      chatController.handleDisconnection(socket);
    });
  });
};

module.exports = attachSocketHandlers;
