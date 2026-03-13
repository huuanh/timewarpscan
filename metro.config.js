const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    /**
     * react-native-webview v13+ sets "react-native": "src/index.ts" in its
     * package.json. Metro follows that field and tries to transform unbuilt
     * TypeScript source inside node_modules, which fails.
     * Force Metro to use the compiled index.js instead.
     */
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName === 'react-native-webview') {
        return {
          filePath: path.resolve(
            __dirname,
            'node_modules/react-native-webview/index.js',
          ),
          type: 'sourceFile',
        };
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
