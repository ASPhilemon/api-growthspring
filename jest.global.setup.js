import { MongoMemoryReplSet, MongoMemoryServer } from 'mongodb-memory-server';

export default async function globalSetup() {
  // console.log('\n--- Jest Global Setup: Starting MongoDB Memory Server ---');

  const mongod = await MongoMemoryReplSet.create({
    replSet: {
      count: 1,
      storageEngine: "wiredTiger"
    },
    binary:{
      version: "8.0.0"
    }
  })
   //const mongod = await MongoMemoryServer.create()
  const uri =  mongod.getUri()

  globalThis.__MONGOD__ = mongod;
  globalThis.__MONGO_URI__ = uri;

  console.log(`\nMongoDB Memory Server Running on: ${uri}`);
  // console.log('--- Jest Global Setup: Complete ---');
}
