import mongoose from "mongoose";

const NODE_ENV = process.env.NODE_ENV;
const DEBUG = NODE_ENV == "debug" || NODE_ENV == "debug-mongoose"

if (NODE_ENV === "debug-mongoose") {
  mongoose.set('debug', true);
}
mongoose.set('transactionAsyncLocalStorage', true);

export default async function connectDB(MONGODB_URI) {
  if (!MONGODB_URI) throw new Error('MongoDB URI is required');
  
  // already connected to mongodb
  if (mongoose.connection.readyState === 1) return;
  
  await mongoose.connect(MONGODB_URI);
  DEBUG && console.log("=== connected to mongodb")
}

export async function disconnectDB() {
  if (mongoose.connection.readyState === 0) return;
  await mongoose.disconnect();
  DEBUG && console.log("=== disconnected from mongodb.")
}