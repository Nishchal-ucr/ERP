import { spawnSync } from "node:child_process";
import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const revision =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  spawnSync("git", ["rev-parse", "HEAD"], {
    encoding: "utf-8",
  }).stdout?.trim() ||
  "0";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  register: true,
  disable: false,
  scope: "/",
  cacheOnNavigation: true,
  additionalPrecacheEntries: [
    { url: "/offline", revision },
    { url: "/", revision },
    { url: "/login", revision },
    { url: "/feed-plant-entry", revision },
    { url: "/feed-plant-entry/add-entry", revision },
    { url: "/sales-entry", revision },
    { url: "/sales-entry/add-entry", revision },
    { url: "/shed-data-entry", revision },
    { url: "/shed-data-entry/add-entry", revision },
  ],
});

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSerwist(nextConfig);
