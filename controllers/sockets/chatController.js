const chatController = {
  handleConnection(socket, _io) {
    // Handle room-based chat messages
    socket.on('send_chat_message', ({ roomId, message }) => {
      if (!roomId || !message) {
        return socket.emit('error', {
          message: 'Room ID and message are required',
        });
      }

      const chatMessage = {
        id: Date.now(),
        user: {
          id: socket.data.user?._id || socket.id,
          username: socket.data.user?.username || 'Anonymous',
        },
        message: message.trim(),
        timestamp: new Date().toISOString(),
        roomId,
      };

      // Send to all players in the room (including sender)
      socket.to(roomId).emit('chat_message_received', chatMessage);
      socket.emit('chat_message_sent', chatMessage);
    });

    // Handle typing indicators
    socket.on('typing_start', ({ roomId }) => {
      if (roomId) {
        socket.to(roomId).emit('user_typing', {
          user: {
            id: socket.data.user?._id || socket.id,
            username: socket.data.user?.username || 'Anonymous',
          },
          roomId,
        });
      }
    });

    socket.on('typing_stop', ({ roomId }) => {
      if (roomId) {
        socket.to(roomId).emit('user_stopped_typing', {
          user: {
            id: socket.data.user?._id || socket.id,
            username: socket.data.user?.username || 'Anonymous',
          },
          roomId,
        });
      }
    });
  },

  handleDisconnection(_socket) {
    // Chat cleanup handled by xiangqi controller
  },
};

module.exports = chatController;
