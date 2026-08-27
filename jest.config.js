module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^expo-sqlite$': '<rootDir>/__mocks__/expo-module.js',
    '^expo-file-system$': '<rootDir>/__mocks__/expo-module.js',
    '^expo-sharing$': '<rootDir>/__mocks__/expo-module.js',
    '^expo-document-picker$': '<rootDir>/__mocks__/expo-module.js',
    '^expo-print$': '<rootDir>/__mocks__/expo-module.js',
    '^expo-secure-store$': '<rootDir>/__mocks__/expo-module.js',
    '^expo-crypto$': '<rootDir>/__mocks__/expo-module.js',
    '^expo-application$': '<rootDir>/__mocks__/expo-module.js',
  },
  transformIgnorePatterns: ['node_modules/'],
};
