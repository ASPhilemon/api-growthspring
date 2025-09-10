import mongoose from "mongoose";

const NODE_ENV = process.env.NODE_ENV;

if (NODE_ENV === "debug-mongoose") {
  mongoose.set('debug', true);
}
mongoose.set('transactionAsyncLocalStorage', true);

async function connectDB(MONGODB_URI) {
  if (!MONGODB_URI) {
    console.error('MongoDB URI is undefined');
    throw new Error('MongoDB URI is required');
  }
  if (mongoose.connection.readyState === 1) {
    console.log('Already connected to MongoDB');
    return;
  }
  try {
    console.log('Attempting to connect to MongoDB:', MONGODB_URI);
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10_000,
    });
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB Connection Error:', err.message);
    throw new Error(`Failed to connect to MongoDB: ${err.message}`);
  }
}

export default connectDB;