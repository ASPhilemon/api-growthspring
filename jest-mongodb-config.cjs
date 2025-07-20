module.exports = {
  mongodbMemoryServerOptions: {
    binary: {
      version: '8.0.0',
      skipMD5: true,
    },
    instance: {
      dbName: 'test',
    },
    replSet: {
      count: 2,
      storageEngine: 'wiredTiger',
    },
    mongoURLEnvName: 'mongo',
    autoStart: false,
  },
};