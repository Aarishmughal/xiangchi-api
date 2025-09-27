const xiangqiController = {
  handleConnection(socket, _io) {
    // Handle xiangqi game connection
    socket.emit('xiangqi_connected', {
      message: 'Connected to Xiangqi game server',
    });
  },

  handleDisconnection(socket) {
    console.log('Chat: User disconnected:', socket.id);
  },
};

module.exports = xiangqiController;
