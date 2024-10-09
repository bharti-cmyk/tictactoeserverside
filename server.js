// Import required modules
const { createServer } = require("http");
const { Server } = require("socket.io");

// Create an HTTP server and initialize Socket.IO with CORS configuration
const httpServer = createServer();
const io = new Server(httpServer, {
  cors: "http://localhost:3000/",
});

// Store information about connected users and active rooms
const allUsers = {};
const allRooms = [];

// Listen for new connections
io.on("connection", (socket) => {
  // Store the connected user's socket and status
  allUsers[socket.id] = {
    socket,
    online: true,
    playerName: null,
    playing: false,
  };

  // Handle player request to start a game
  socket.on("request_to_play", (data) => {
    const currentUser = allUsers[socket.id];
    currentUser.playerName = data.playerName;

    let opponentPlayer = null;

    // Search for an available opponent
    for (const key in allUsers) {
      const user = allUsers[key];
      if (user.online && !user.playing && socket.id !== key) {
        opponentPlayer = user;
        break;
      }
    }

    if (opponentPlayer) {
      // Create a new room for matched players
      allRooms.push({
        player1: opponentPlayer,
        player2: currentUser,
      });

      // Update player statuses
      currentUser.playing = true;
      opponentPlayer.playing = true;

      // Notify both players of the match and assign symbols
      currentUser.socket.emit("OpponentFound", {
        opponentName: opponentPlayer.playerName,
        playingAs: "circle",
      });

      opponentPlayer.socket.emit("OpponentFound", {
        opponentName: currentUser.playerName,
        playingAs: "cross",
      });

      // Set up listeners for player moves and relay them to the opponent
      setupPlayerMoveListener(currentUser, opponentPlayer);
      setupPlayerMoveListener(opponentPlayer, currentUser);
    } else {
      // Notify the user if no opponent is available
      currentUser.socket.emit("OpponentNotFound");
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    const currentUser = allUsers[socket.id];
    if (!currentUser) return;

    // Mark user as offline and update playing status
    currentUser.online = false;
    currentUser.playing = false;

    // Notify the opponent if the user was in a game
    notifyOpponentOnDisconnect(socket.id);
  });
});

// Helper function to relay moves between matched players
const setupPlayerMoveListener = (player, opponent) => {
  player.socket.on("playerMoveFromClient", (data) => {
    opponent.socket.emit("playerMoveFromServer", data);
  });
};

// Notify the opponent when a player disconnects
const notifyOpponentOnDisconnect = (socketId) => {
  // Find the room where the user was playing and notify the opponent
  for (let index = 0; index < allRooms.length; index++) {
    const { player1, player2 } = allRooms[index];

    if (player1.socket.id === socketId) {
      player2.socket.emit("opponentLeftMatch");
      return;
    }

    if (player2.socket.id === socketId) {
      player1.socket.emit("opponentLeftMatch");
      return;
    }
  }
};

// Start the HTTP server on port 8000
httpServer.listen(8000, () => {
  console.log("Server is running on http://localhost:8000");
});
