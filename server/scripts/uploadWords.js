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
  fourth_of_july,
  Halloween,
  Valentines_Day,
  occupations,
  brands,
  cars,
  states,
  plants,
  technology,
  colors,
  opposites,
  rhymes,
  books,
  toys,
} from "../../client/src/scripts/data.js";

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri);

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
  fourth_of_july,
  Halloween,
  Valentines_Day,
  occupations,
  brands,
  cars,
  states,
  plants,
  technology,
  colors,
  opposites,
  rhymes,
  books,
  toys,
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
      await collection.insertMany(items.map((item) => ({ word: item })));

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
