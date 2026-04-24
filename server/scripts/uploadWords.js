import { MongoClient } from "mongodb";

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
  phrases,
  mythology,
  buildings,
  furniture,
  musical_instruments,
  superheroes,
} from "../../client/src/scripts/data.js";

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

// Store lists in an object
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
  phrases,
  mythology,
  buildings,
  furniture,
  musical_instruments,
  superheroes,
};

async function uploadAll() {
  try {
    await client.connect();
    const db = client.db("words");

    console.log("Connected to MongoDB ✔");

    for (const [category, items] of Object.entries(lists)) {
      const collection = db.collection(category);

      // Clear old data
      await collection.deleteMany({});
      console.log(`Cleared ${category}`);

      // Insert words
      const documents = items.map((word) => ({
        word: word.toUpperCase(),
        category: category,
      }));

      await collection.insertMany(documents);

      console.log(`Uploaded ${documents.length} words to ${category} ✔`);
    }

    console.log("🎉 All word lists uploaded successfully!");
  } catch (err) {
    console.error("❌ Upload error:", err);
  } finally {
    await client.close();
    console.log("MongoDB connection closed");
  }
}

uploadAll();
