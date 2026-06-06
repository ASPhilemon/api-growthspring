import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import js from "@eslint/js";


const globalRules = {
  "func-style": ["error", "declaration"],
  "one-var": "off",
  "no-plusplus": "off",
  "no-use-before-define": "off",
  "sort-imports": "off",
  "max-statements": ["error", 80],
  "no-underscore-dangle": "off",
  "sort-keys": "off",
  "no-ternary": "off",
  "no-param-reassign": "off",
  "max-lines": "off",
  "no-magic-numbers": "off",
  "new-cap": "off",
  "id-length": [ "error", {
    min: 2,
      exceptions: ["i", "j", "k", "x", "y", "_"]
    }
  ]
}

const testsRules = {
  "no-undef": "off",
}

export default defineConfig([
  globalIgnores(["eslint.config.js"]),

  {
    extends: ["js/all"],
    linterOptions: {
      "noInlineConfig": true,
    },
    files: ["**/*.{js,mjs,cjs}"],
    languageOptions: { globals: globals.node },
    plugins: { js },
    rules: globalRules,
  },
  {
    files: ["**/__tests__/**/*.{js,mjs,cjs}"],
    rules: testsRules,
  }
]);
