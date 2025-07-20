export default async function globalTeardown() {
  // console.log('\nStopping MongoDB Memory Server ---');

  await globalThis.__MONGOD__.stop();
  console.log("MongoDB Memory Server stopped.");
  
  // Clean up global variables
  delete globalThis.__MONGOD__;
  delete globalThis.__MONGO_URI__;

  // console.log('--- Jest Global Teardown: Complete ---');
}