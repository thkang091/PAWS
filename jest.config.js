/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: {
          strict: false,
          esModuleInterop: true,
        },
      },
    ],
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^../../modules/paws-pose/index$": "<rootDir>/src/__tests__/__mocks__/pawsPoseModule.ts",
    "^paws-pose$": "<rootDir>/src/__tests__/__mocks__/pawsPoseModule.ts",
  },
  testMatch: ["<rootDir>/src/__tests__/**/*.test.ts"],
  setupFilesAfterEnv: [],
};
