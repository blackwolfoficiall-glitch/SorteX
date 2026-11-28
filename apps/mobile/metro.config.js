const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');
const config = getDefaultConfig(__dirname);
config.watchFolders = [
  path.resolve(__dirname, '../../packages/contracts'),
  path.resolve(__dirname, '../../packages/design-tokens'),
];
module.exports = config;
