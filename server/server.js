import express from "express";
import path from "path";
import http from "http";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import { setupRooms } from "./sockets/roomHandler.js";
import apiRoutes from "./routes.js";

const port = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {});

app.use(express.static(path.join(__dirname, "../client")));
app.use(express.static(path.join(__dirname, "../client/src")));
app.use(express.static(path.join(__dirname, "../client/public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/index.html"));
});

// Route for hangman page
app.get("/hangman", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/pages/hangman.html"));
});

// Route for test page
app.get("/test", (req, res) => {
  res.sendFile(path.join(__dirname, "../client/pages/test.html"));
});

setupRooms(io);

app.use("/api", apiRoutes);

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
