/**
 * Post-install patch: Fix VisionCamera SkiaCameraCanvas onLayout incompatibility
 * with New Architecture (Fabric).
 * Replaces onLayout with useWindowDimensions.
 */
const fs = require('fs');
const path = require('path');

const files = [
  'node_modules/react-native-vision-camera/lib/module/skia/SkiaCameraCanvas.js',
  'node_modules/react-native-vision-camera/lib/commonjs/skia/SkiaCameraCanvas.js',
];

files.forEach((filePath) => {
  const full = path.resolve(__dirname, '..', filePath);
  if (!fs.existsSync(full)) return;
  let code = fs.readFileSync(full, 'utf8');
  if (!code.includes('onLayout')) return; // already patched

  // Replace useState + onLayout with useWindowDimensions
  code = code.replace(/import React,\s*\{[^}]*\}\s*from\s*'react'/, "import React from 'react';\nimport { useWindowDimensions } from 'react-native'");
  code = code.replace(/var _react = _interopRequireWildcard\(require\("react"\)\);/, 'var _react = _interopRequireWildcard(require("react"));\nvar _reactNative = require("react-native");');
  code = code.replace(/const \[width, setWidth\][^;]+;/, 'const { width, height } = typeof useWindowDimensions !== "undefined" ? useWindowDimensions() : (0, _reactNative.useWindowDimensions)();');
  code = code.replace(/const \[height, setHeight\][^;]+;/, '');
  code = code.replace(/const onLayout[^}]+\}\);/, '');
  code = code.replace(/\}\s*,\s*\[\]\s*\)\s*;/, '');
  code = code.replace(/onLayout:\s*onLayout,?\s*\n?/g, '');
  code = code.replace(/onLayout,?\s*\n?/g, '');

  fs.writeFileSync(full, code, 'utf8');
  console.log(`Patched: ${filePath}`);
});
