import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/zod.ts"],
    rules: {
      "no-restricted-imports": ["error", { paths: [{ name: "zod", message: "Import z from \"@/lib/zod\" (it turns off zod's eval test, which the content policy reports)." }] }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".next-dev/**",
    ".next-build/**",
    // Copies of the live build kept before each deploy, and check builds made into a separate folder.
    ".next-build-backup-*/**",
    ".next-buildcheck/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local workspace temp artifacts that should not be linted.
    "temp*",
    "tmp*",
  ]),
]);

export default eslintConfig;
