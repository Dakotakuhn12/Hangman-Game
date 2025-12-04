import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const port = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/hangman.html"));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
