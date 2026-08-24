import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_SHA:
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.GITHUB_SHA ||
      process.env.COMMIT_SHA ||
      "local",
  },
  webpack: (config, { dev }) => {
    if (dev) {
      const existing = config.watchOptions ?? {};
      const prevIgnored = existing.ignored;

      // Webpack schema in this Next build requires ignored[] entries to be
      // non-empty glob strings. Next's baseWatchOptions.ignored is a RegExp
      // matching node_modules / .git / .next — do NOT wrap that RegExp into
      // an array (that yields ignored[0] as a non-string ValidationError).
      const nextIgnored: string[] = [];
      if (typeof prevIgnored === "string" && prevIgnored.length > 0) {
        nextIgnored.push(prevIgnored);
      } else if (Array.isArray(prevIgnored)) {
        for (const item of prevIgnored) {
          if (typeof item === "string" && item.length > 0) {
            nextIgnored.push(item);
          }
        }
      } else if (prevIgnored instanceof RegExp) {
        // Translate Next's documented RegExp ignores into schema-valid globs.
        nextIgnored.push(
          "**/node_modules/**",
          "**/.git/**",
          "**/.next/**"
        );
      }
      if (!nextIgnored.includes("**/tmp/**")) {
        nextIgnored.push("**/tmp/**");
      }

      // Replace watchOptions wholesale — nested `ignored` may be read-only.
      config.watchOptions = {
        ...existing,
        ignored: nextIgnored,
      };
    }
    return config;
  },
};

export default nextConfig;
