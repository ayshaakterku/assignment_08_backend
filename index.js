import express from "express";
import "dotenv/config";
import { MongoClient, ObjectId } from "mongodb";
import cors from "cors";
import { createRemoteJWKSet, jwtVerify } from "jose";

const app = express();
app.use(cors());
app.use(express.json());
const PORT = 5000;

// Token verification middleware
const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Check Authorization header
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({
      success: false,
      msg: "Unauthorized! Token is missing.",
    });
  }

  const token = authHeader.split(" ")[1];

  const JWKS = createRemoteJWKSet(
    new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
  );

  try {
    const { payload } = await jwtVerify(token, JWKS);

    // Store verified user information
    req.user = payload;

    next();
  } catch (error) {
    console.error("Token verification failed:", error.message);

    return res.status(401).send({
      success: false,
      msg: "Invalid or expired token!",
    });
  }
};

const client = new MongoClient(process.env.MONGODB_URI);
export async function connectToMongoDB() {
  try {
    await client.connect();
    console.log("You successfully connected to MongoDB!");
    return client;
  } catch (err) {
    console.dir(err);
  }
}

// data sent to database, create db and collection
const mongoClient = await connectToMongoDB();
const db = mongoClient.db("book-nook");
const bookCollection = db.collection("allbooks");
const myBookCollection = db.collection("myBorrowBooks");


// add book from frontend
//http://localhost:5000/add-book
app.post("/add-book", verifyToken, async (req, res) => {
  const data = req.body;
  const result = await bookCollection.insertOne(data);
  console.log("Api: ", data);
  console.log("Api Result: ", result);
  res.send({ message: "Api working..." });
  res.send(result);
});


// show all books
app.get("/all-book", async (req, res) => {
  const result = await bookCollection.find().toArray();
  res.send(result);
});

// all books findout by email-> my books
// Books added by one user (you already have this)
app.get("/my-books/:email", verifyToken, async (req, res) => {
  const result = await bookCollection
    .find({ email: req.params.email })
    .toArray();
  res.send(result);
});

// Update->
app.put("/update-book/:id", verifyToken, async (req, res) => {
  const { _id, email, username, ...updates } = req.body; // never overwrite owner fields
  const result = await bookCollection.updateOne(
    { _id: new ObjectId(req.params.id) },
    { $set: updates },
  );
  res.send(result);
});

//single book findout by id
//http://localhost:5000/book/:id
app.get("/single-book/:id", verifyToken, async (req, res) => {
  const { id } = req.params;
  const result = await bookCollection.findOne({
    _id: new ObjectId(id),
  });
  res.send(result);
});

// book findout by category
//http://localhost:5000/book/:category
app.get("/book-category/:category/:id", verifyToken, async (req, res) => {
  const { category, id } = req.params;
  const result = await bookCollection
    .find({
      category: category,
      _id: { $ne: new ObjectId(id) },
    })
    .toArray();
  res.send(result);
});


//...............New start................
// Borrow a book
app.post("/addtomycollection", verifyToken, async (req, res) => {
  const { _id, ...book } = req.body;
  const borrowDate = new Date();
  const returnDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const result = await myBookCollection.insertOne({
    bookId: _id,
    ...book,
    borrowDate,
    returnDate,
  });

  // optional: reduce available copies (totalCopies must be a number in the DB)
  await bookCollection.updateOne(
    { _id: new ObjectId(_id) },
    { $inc: { totalCopies: -1 } },
  );

  res.send(result);
});

// Show all borrowed books by specific email
app.get("/showmycollection/:email", verifyToken, async (req, res) => {
  const email = req.params.email;
  const result = await myBookCollection.find({ email: email }).toArray();
  res.send(result);
});

// Return a book
app.delete("/returnbook/:id", verifyToken, async (req, res) => {
  const record = await myBookCollection.findOne({
    _id: new ObjectId(req.params.id),
  });
  const result = await myBookCollection.deleteOne({
    _id: new ObjectId(req.params.id),
  });

  if (record?.bookId) {
    await bookCollection.updateOne(
      { _id: new ObjectId(record.bookId) },
      { $inc: { totalCopies: 1 } },
    );
  }

  res.send(result);
});

//.........................new end................