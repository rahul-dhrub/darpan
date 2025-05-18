const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static("public"));

io.on("connection", socket => {
  console.log("User connected:", socket.id);

  socket.on("join-room", roomId => {
    socket.join(roomId);
    socket.to(roomId).emit("user-connected", socket.id);

    socket.on("disconnect", () => {
      socket.to(roomId).emit("user-disconnected", socket.id);
    });

    socket.on("offer", data => {
      socket.to(data.to).emit("offer", {
        from: socket.id,
        offer: data.offer
      });
    });

    socket.on("answer", data => {
      socket.to(data.to).emit("answer", {
        from: socket.id,
        answer: data.answer
      });
    });

    socket.on("ice-candidate", data => {
      socket.to(data.to).emit("ice-candidate", {
        from: socket.id,
        candidate: data.candidate
      });
    });
  });
});

server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
