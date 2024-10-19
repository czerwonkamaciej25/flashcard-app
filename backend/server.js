// backend/server.js

const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(express.json());

// Konfiguracja połączenia z MongoDB
const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,
    deprecationErrors: true,
  },
});

let flashcardsCollection;

async function run() {
  try {
    await client.connect();
    console.log("Połączono z MongoDB!");

    const db = client.db("fiszki");
    flashcardsCollection = db.collection("flashcard");

    defineEndpoints();

    app.listen(PORT, () => {
      console.log(`Serwer działa na porcie ${PORT}`);
    });
  } catch (err) {
    console.error("Błąd połączenia z MongoDB:", err);
  }
}

run().catch(console.dir);

// Definicja endpointów API
function defineEndpoints() {
  // Endpoint do pobierania kategorii
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await flashcardsCollection.distinct("category");
      res.json(categories);
    } catch (error) {
      console.error("Błąd pobierania kategorii:", error.stack);
      res.status(500).send("Internal Server Error");
    }
  });

  // Endpoint do dodawania nowej kategorii
  app.post("/api/categories", async (req, res) => {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Nazwa kategorii jest wymagana' });
    }

    try {
      const existingCategory = await flashcardsCollection.distinct('category', { category: name });
      if (existingCategory.length > 0) {
        return res.status(400).json({ error: 'Taka kategoria już istnieje' });
      }

      await flashcardsCollection.insertOne({ category: name });
      res.status(201).json({ message: 'Kategoria została dodana' });
    } catch (error) {
      console.error("Błąd dodawania kategorii:", error);
      res.status(500).json({ error: 'Błąd serwera' });
    }
  });

  // Pobieranie fiszek z obsługą parametrów 'all' i 'category'
  app.get("/api/flashcards", async (req, res) => {
    try {
      const today = new Date();
      const { all, category } = req.query;

      let query = {};
      if (all !== "true") {
        query.nextReview = { $lte: today };
      }
      if (category) {
        query.category = category;
      }

      const flashcards = await flashcardsCollection.find(query).toArray();

      const flashcardsWithStringId = flashcards.map((flashcard) => ({
        ...flashcard,
        _id: flashcard._id.toString(),
        nextReview: flashcard.nextReview.toISOString(),
        created_at: flashcard.created_at.toISOString(),
      }));

      res.json(flashcardsWithStringId);
    } catch (error) {
      console.error("Błąd pobierania fiszek:", error);
      res.status(500).send("Internal Server Error");
    }
  });

  // Aktualizacja fiszki po powtórce (algorytm SM2)
  app.post("/api/flashcards/:id/review", async (req, res) => {
    const { id } = req.params;
    const { quality } = req.body;

    try {
      const objectId = new ObjectId(id);
      const flashcard = await flashcardsCollection.findOne({ _id: objectId });

      if (!flashcard) {
        return res.status(404).json({ error: "Nie znaleziono fiszki" });
      }

      let { repetitions, easiness, interval } = flashcard;

      easiness = Math.max(
        1.3,
        easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
      );

      if (quality < 3) {
        repetitions = 0;
        interval = 1;
      } else {
        repetitions += 1;
        if (repetitions === 1) {
          interval = 1;
        } else if (repetitions === 2) {
          interval = 6;
        } else {
          interval = Math.round(interval * easiness);
        }
      }

      const nextReview = new Date();
      nextReview.setDate(nextReview.getDate() + interval);

      await flashcardsCollection.updateOne(
        { _id: objectId },
        {
          $set: {
            repetitions,
            easiness,
            interval,
            nextReview,
            known: quality >= 3,
          },
        }
      );

      res.json({
        message: "Fiszka została zaktualizowana",
        nextReview: nextReview.toISOString(),
      });
    } catch (error) {
      console.error("Błąd aktualizacji fiszki:", error.message);
      res.status(400).json({ error: "Nieprawidłowe ID fiszki" });
    }
  });

  // Dodawanie nowej fiszki z kategorią
  app.post("/api/flashcards", async (req, res) => {
    const { english, polish, category } = req.body;

    if (!english || !polish) {
      return res.status(400).json({ error: "Pola 'english' i 'polish' są wymagane" });
    }

    try {
      const now = new Date();
      const newFlashcard = {
        english,
        polish,
        category: category || "default",
        repetitions: 0,
        easiness: 2.5,
        interval: 1,
        nextReview: now,
        known: false,
        created_at: now,
      };

      const result = await flashcardsCollection.insertOne(newFlashcard);

      const responseFlashcard = {
        _id: result.insertedId,
        ...newFlashcard,
        nextReview: newFlashcard.nextReview.toISOString(),
        created_at: newFlashcard.created_at.toISOString(),
      };

      res.status(201).json(responseFlashcard);
    } catch (error) {
      console.error("Błąd dodawania fiszki:", error.message);
      res.status(500).send("Internal Server Error");
    }
  });

  // Usuwanie fiszki
  app.delete("/api/flashcards/:id", async (req, res) => {
    const { id } = req.params;
    await flashcardsCollection.deleteOne({ _id: new ObjectId(id) });
    res.json({ message: "Fiszka została usunięta" });
  });

  // Endpoint do masowego dodawania fiszek
  app.post('/api/flashcards/bulk_add', async (req, res) => {
    const { data, category } = req.body;

    if (!data || !category) {
      return res.status(400).json({ error: 'Dane i kategoria są wymagane' });
    }

    const lines = data.split('\n');
    const flashcards = [];

    for (const line of lines) {
      // Ignoruj puste linie
      if (line.trim() === '') continue;

      const [english, polish] = line.split(';').map((text) => text.trim());

      if (english && polish) {
        flashcards.push({
          english,
          polish,
          category,
          repetitions: 0,
          easiness: 2.5,
          interval: 1,
          nextReview: new Date(),
          known: false,
          created_at: new Date(),
        });
      } else {
        console.warn('Pominięto nieprawidłowy wiersz:', line);
      }
    }

    if (flashcards.length === 0) {
      return res.status(400).json({ error: 'Brak poprawnych danych do dodania' });
    }

    try {
      await flashcardsCollection.insertMany(flashcards);
      res.status(201).json({ message: 'Słówka zostały dodane pomyślnie' });
    } catch (error) {
      console.error('Błąd podczas dodawania słówek:', error);
      res.status(500).json({ error: 'Błąd podczas dodawania słówek' });
    }
  });
}
