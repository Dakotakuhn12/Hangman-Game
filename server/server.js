import express from "express";
import path from "path";
import http from "http";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import { setupRooms } from "./sockets/roomHandler.js";
import { connectDB } from "./utils/db.js";

const port = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {});

connectDB();

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

setupRooms(io)

app.get("/words", async (req, res) => {
  try {
    const { category, limit } = req.query;
    
    const collection = db.collection("words");
    let query = {};
    
    if (category && category !== "all") {
      query.category = category;
    }
    
    // Get random words
    const pipeline = [
      { $match: query },
      { $sample: { size: parseInt(limit) || 100 } }
    ];
    
    const words = await collection.aggregate(pipeline).toArray();
    
    res.json({
      success: true,
      words: words
    });
  } catch (error) {
    console.error("Error fetching words:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch words"
    });
  }
});

// API endpoint to get categories
app.get("/categories", async (req, res) => {
  try {
    const collection = db.collection("words");
    const categories = await collection.distinct("category");
    
    res.json({
      success: true,
      categories: categories
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch categories"
    });
  }
});

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
