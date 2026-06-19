const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// 외부 볼륨(exFAT 등)에서 생기는 macOS AppleDouble(._*) 파일을 번들 대상에서 제외
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
      ? [config.resolver.blockList]
      : []),
  /(^|\/)\._.*/,
];

module.exports = withNativeWind(config, { input: './src/global.css' });
