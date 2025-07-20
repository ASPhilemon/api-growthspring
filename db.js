import mongoose from "mongoose"

//for easy session handling in transactions
mongoose.set('transactionAsyncLocalStorage', true);

async function connectDB(MONGODB_URI) {

  if (mongoose.connection.readyState === 1) {
    console.log('Already connected to MongoDB');
    return;
  }

  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10_000
    });
    console.log('Connected to MongoDB');
  } catch (err) {
    console.log('MongoDB Connection Error:', err.message);
    process.exit(1);
  }
}

export default connectDB;