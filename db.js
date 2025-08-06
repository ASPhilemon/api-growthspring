import mongoose from "mongoose"

const NODE_ENV = process.env.NODE_ENV

NODE_ENV == "debug-mongoose" && mongoose.set('debug', true);

//for easy session handling in transactions
mongoose.set('transactionAsyncLocalStorage', true);

async function connectDB(MONGODB_URI) {
  if (mongoose.connection.readyState === 1) {
    NODE_ENV == "debug" && console.log('Already connected to MongoDB');
    return;
  }
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10_000,
    });
    NODE_ENV == "debug" && console.log('Connected to MongoDB: ' + MONGODB_URI);
  } catch (err) {
    NODE_ENV == "debug" && console.log('MongoDB Connection Error:', err.message);
    process.exit(1);
  }
}

export default connectDB;