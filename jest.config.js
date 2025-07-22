export default {
  "preset": "@shelf/jest-mongodb",
  transform: {},
  testMatch: ['**/*.test.js'],
  watchPathIgnorePatterns: [
    "<rootDir>/globalConfig.json"
  ]
};
