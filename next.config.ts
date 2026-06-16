import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure the /skills/*/SKILL.md files are bundled into the serverless functions
  // (the skill registry reads them at runtime).
  outputFileTracingIncludes: {
    "/api/**/*": ["./skills/**/*"],
  },
};

export default nextConfig;
