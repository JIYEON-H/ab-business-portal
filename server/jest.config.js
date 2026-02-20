/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/app.ts',
    "!src/adapters/*.ts"
  ],
  coverageThreshold: {
    global: {
      branches: 25,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
};
