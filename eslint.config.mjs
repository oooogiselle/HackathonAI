import { defineConfig, globalIgnores } from "eslint/config";
import prettier from "eslint-config-prettier/flat";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Turns off ESLint rules that conflict with Prettier. Keep last.
  prettier,
  globalIgnores([".claude/**", ".next/**", ".next-e2e/**", ".next-e2e-*/**", ".next-shot/**", "test-results/**", "playwright-report/**", "out/**", "build/**", "next-env.d.ts", "drizzle/**"]),
]);

export default eslintConfig;
