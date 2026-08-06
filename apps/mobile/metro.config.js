const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

config.resolver.sourceExtensions = [
    'android.js', 'android.tsx', 'android.ts',
    'ios.js', 'ios.tsx', 'ios.ts',
    'native.js', 'native.tsx', 'native.ts',
    'ts', 'tsx', 'js', 'jsx', 'json',
];

module.exports = config;
