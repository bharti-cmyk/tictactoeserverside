const { createServer } = require("http");
const { Server } = require("socket.io");

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:3000", // Change to your frontend URL if needed
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const allUsers = {};
const allRooms = [];

io.on("connection", (socket) => {
  // Add the new user and mark them as online
  allUsers[socket.id] = {
    socket: socket,
    online: true,
    playing: false, // Add the playing status
  };

  socket.on("request_to_play", (data) => {
    const currentUser = allUsers[socket.id];
    currentUser.playerName = data.playerName;

    let opponentPlayer;

    // Find an available opponent
    for (const key in allUsers) {
      const user = allUsers[key];
      if (user.online && !user.playing && socket.id !== key) {
        opponentPlayer = user;
        break;
      }
    }

    if (opponentPlayer) {
      // Create a new room for the matched players
      allRooms.push({
        player1: opponentPlayer,
        player2: currentUser,
      });

      // Mark players as playing
      currentUser.playing = true;
      opponentPlayer.playing = true;

      // Notify both players of the match
      currentUser.socket.emit("OpponentFound", {
        opponentName: opponentPlayer.playerName,
        playingAs: "circle",
      });

      opponentPlayer.socket.emit("OpponentFound", {
        opponentName: currentUser.playerName,
        playingAs: "cross",
      });

      // Set up listeners for player moves
      setupPlayerMoveListener(currentUser, opponentPlayer);
      setupPlayerMoveListener(opponentPlayer, currentUser);
    } else {
      currentUser.socket.emit("OpponentNotFound");
    }
  });

  // Handle disconnection
  socket.on("disconnect", function () {
    const currentUser = allUsers[socket.id];
    if (!currentUser) return; // Check if the user exists

    // Mark user as offline and not playing
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
  for (let index = 0; index < allRooms.length; index++) {
    const { player1, player2 } = allRooms[index];

    if (player1.socket.id === socketId) {
      player2.socket.emit("opponentLeftMatch");
      // Optionally, remove the room
      allRooms.splice(index, 1);
      break;
    }

    if (player2.socket.id === socketId) {
      player1.socket.emit("opponentLeftMatch");
      // Optionally, remove the room
      allRooms.splice(index, 1);
      break;
    }
  }
};

httpServer.listen(8000, () => {
  console.log("Server is running on http://localhost:8000");
});
