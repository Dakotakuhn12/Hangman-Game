import { Router } from "express";
import { connectDB, getDb } from "./utils/db.js";

const router = Router();

// In-memory cache
let cachedWords = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

router.get("/words", async (req, res) => {
  try {
    const now = Date.now();

    // If cached and not expired, return cache
    if (cachedWords && now - lastFetchTime < CACHE_DURATION) {
      return res.json(cachedWords);
    }

    await connectDB();
    const db = getDb("words");
    
    const collectionsInfo = await db.listCollections().toArray();
    const collectionNames = collectionsInfo.map(c => c.name);

    let allWords = [];
    for (const name of collectionNames) {
      const collection = db.collection(name);
      const docs = await collection.find({}).toArray();
      
      const wordsWithCategory = docs.map(doc => ({
        ...doc,
        category: name,
      }));

      allWords.push(...wordsWithCategory);
    }

    // Update cache
    cachedWords = allWords;
    lastFetchTime = now;

    res.json(allWords);
  } catch (err) {
    console.error("Error fetching words:", err);
    res.status(500).json({ error: "Failed to fetch words" });
  }
});

export default router;
