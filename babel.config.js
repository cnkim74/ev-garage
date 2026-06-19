module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // react-native-worklets/plugin 은 항상 plugins 배열의 마지막에 위치해야 함 (Reanimated 4)
    plugins: ['react-native-worklets/plugin'],
  };
};
