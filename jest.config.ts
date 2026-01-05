import { createDefaultPreset } from 'ts-jest';
import type { Config } from 'jest';

// Get the default transform configuration from ts-jest
const tsJestTransformCfg = createDefaultPreset().transform;

const config: Config = {
  testEnvironment: "node",
  
  transform: {
    ...tsJestTransformCfg, 
  },

  testMatch: ['**/**/*.test.ts'],
  verbose: true,
  forceExit: true,
  clearMocks: true,
};

export default config;