const { createDefaultPreset } = require("ts-jest");

const tsJestTransformCfg = createDefaultPreset().transform;

module.exports = {

  testEnvironment: "node",

  transform: {
    ...tsJestTransformCfg, 
  },

  testMatch: ['**/**/*.test.ts'],
  verbose: true,
  forceExit: true,
  clearMocks: true,
};