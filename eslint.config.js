// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
  {
    rules: {
      // Hebrew UI text legitimately contains straight quotes (e.g. מע"מ);
      // this rule only concerns HTML entity escaping and adds no value here.
      "react/no-unescaped-entities": "off",
    },
  }
]);
