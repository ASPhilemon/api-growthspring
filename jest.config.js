export default {
  transform: {},
  globalSetup: '<rootDir>/jest.global.setup.js',
  globalTeardown: '<rootDir>/jest.global.teardown.js',
  testMatch: ['**/*.test.js'],
  watchPathIgnorePatterns: [
    "<rootDir>/globalConfig.json"
  ]
};
