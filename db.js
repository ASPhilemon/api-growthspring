import mongoose from "mongoose"

mongoose.set('transactionAsyncLocalStorage', true);

async function connectDB(){
  try {
    await mongoose.connect(process.env.MONGODB_URI, {});
    console.log('Connected to MongoDB');
  } catch (err) {
    console.log('MongoDB Connection Error:', err.message);
    process.exit(1);
  }
};

export default connectDB;