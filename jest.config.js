/** @type {import('jest').Config} */
module.exports = {
  // Run plain TypeScript tests without React Native rendering.
  // These tests cover pure-logic modules that don't import React Native
  // components, so we don't need jest-expo or a React Native transformer.
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          // Relax some checks for test files without affecting the app build.
          strict: false,
          esModuleInterop: true,
        },
      },
    ],
  },
  moduleNameMapper: {
    // Map @/ alias used throughout the project.
    "^@/(.*)$": "<rootDir>/src/$1",
    // Mock the native module in tests.
    "^../../modules/paws-pose/index$": "<rootDir>/src/__tests__/__mocks__/pawsPoseModule.ts",
    "^paws-pose$": "<rootDir>/src/__tests__/__mocks__/pawsPoseModule.ts",
  },
  testMatch: ["<rootDir>/src/__tests__/**/*.test.ts"],
  setupFilesAfterEnv: [],
};
