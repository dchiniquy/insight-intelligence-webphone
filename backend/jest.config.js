module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.js',
    '**/?(*.)+(spec|test).js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/server.js',
    '!src/migrations/**',
    '!src/config/**'
  ],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/jest.setup.js'],
  testTimeout: 30000,
  verbose: true
};