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