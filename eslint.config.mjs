import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores(["dist/", "drizzle/", "node_modules/"]),

  // TypeScript: client app, API server, and root config files.
  {
    files: ["src/**/*.{ts,tsx}", "server/**/*.ts", "*.config.ts", "eslint.config.mjs"],
    extends: [tseslint.configs.recommended],
    rules: {
      // Surfaced as warnings rather than errors: this is an existing
      // codebase, and `bun run lint` is meant to gate on errors only.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  // React hooks discipline for the client.
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
);
