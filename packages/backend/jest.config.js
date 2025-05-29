require('dotenv').config({ path: '.env.test' });
const path = require('path');

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  moduleNameMapper: {
    '^@sovren/shared/(.*)$': path.join(__dirname, '../shared/src/$1'),
  },
  moduleDirectories: ['node_modules', path.join(__dirname, '../shared/src')],
};
