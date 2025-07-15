// jest-mongodb-config.js
module.exports = {
  mongodbMemoryServerOptions: {
    binary: {
      version: '6.0.6',
      skipMD5: true,
    },
    instance: {
      dbName: 'test',
      storageEngine: 'wiredTiger',
    },
    replSet: {
      name: 'jestrs',
      count: 1,
      storageEngine: 'wiredTiger',
    },
    autoStart: true,
  },
  mongoURLEnvName: 'MONGODB_URI',
};