// uploadAll.js
import dotenv from "dotenv";
dotenv.config();

import { MongoClient, ServerApiVersion } from "mongodb";

// Import all your lists
import {
  animal,
  body,
  food,
  game,
  health,
  movies,
  music,
  object,
  place,
  sport,
  song_lyrics,
  historyEvents,
  christmas,
  science,
  drinks,
  famous_people,
  TV_shows,
  countries,
  easter,
  new_years,
  thanksgiving,
} from "../../client/src/scripts/data.js";

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Put all lists into a key/value object
const lists = {
  animal,
  body,
  food,
  game,
  health,
  movies,
  music,
  object,
  place,
  sport,
  song_lyrics,
  historyEvents,
  christmas,
  science,
  drinks,
  famous_people,
  TV_shows,
  countries,
  easter,
  new_years,
  thanksgiving,
};

async function uploadAll() {
  try {
    await client.connect();
    const db = client.db("words");

    console.log("Connected to MongoDB ✔");

    // Loop through every list and upload it
    for (const [collectionName, items] of Object.entries(lists)) {
      const collection = db.collection(collectionName);

      // Clear existing collection
      await collection.deleteMany({});
      console.log(`Cleared old records in: ${collectionName}`);

      // Insert items
      await collection.insertMany(items.map((item) => ({ name: item })));

      console.log(`Uploaded ${collectionName} list ✔`);
    }

    console.log("🎉 All lists uploaded successfully!");
  } catch (err) {
    console.error("❌ Error uploading:", err);
  } finally {
    await client.close();
    console.log("MongoDB connection closed");
  }
}

uploadAll();
