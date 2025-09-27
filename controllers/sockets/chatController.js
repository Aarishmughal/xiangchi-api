const chatController = {
  handleConnection(socket, io) {
    console.log('Chat: User connected:', socket.id);

    socket.on('chat_message', (msg) => {
      console.log('Chat: Message received:', msg);
      const messageWithUser = {
        user: socket.id,
        message: msg,
        timestamp: new Date().toISOString(),
      };
      io.emit('chat_message', messageWithUser); // broadcast to all clients
    });

    socket.on('join_chat_room', (roomId) => {
      socket.join(roomId);
      socket.emit('chat_status', { message: `Joined chat room: ${roomId}` });
    });

    socket.on('leave_chat_room', (roomId) => {
      socket.leave(roomId);
      socket.emit('chat_status', { message: `Left chat room: ${roomId}` });
    });

    socket.on('chat_room_message', ({ roomId, message }) => {
      const messageWithUser = {
        user: socket.id,
        message,
        timestamp: new Date().toISOString(),
        roomId,
      };
      io.to(roomId).emit('chat_room_message', messageWithUser);
    });
  },

  handleDisconnection(socket) {
    console.log('Chat: User disconnected:', socket.id);
  },
};

module.exports = chatController;
