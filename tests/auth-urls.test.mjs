import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveAuthUrls } from "../app/lib/auth-urls.mjs";

test("uses Render's service URL when explicit application URLs are absent", () => {
  assert.deepEqual(
    resolveAuthUrls({
      NODE_ENV: "production",
      RENDER_EXTERNAL_URL: "https://quenue-pilot.onrender.com/",
    }),
    {
      appUrl: "https://quenue-pilot.onrender.com",
      authUrl: "https://quenue-pilot.onrender.com",
    },
  );
});

test("normalizes explicit production origins and keeps the configured auth origin", () => {
  assert.deepEqual(
    resolveAuthUrls({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://app.example.com/",
      BETTER_AUTH_URL: "https://auth.example.com",
      RENDER_EXTERNAL_URL: "https://fallback.onrender.com",
    }),
    {
      appUrl: "https://app.example.com",
      authUrl: "https://auth.example.com",
    },
  );
});

test("rejects insecure or non-origin production URLs", () => {
  assert.throws(
    () =>
      resolveAuthUrls({
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_URL: "http://app.example.com",
      }),
    /must use HTTPS in production/,
  );
  assert.throws(
    () =>
      resolveAuthUrls({
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_URL: "https://app.example.com/path",
      }),
    /must contain only an HTTP\(S\) origin/,
  );
});

test("allows loopback HTTP for local production runs", () => {
  assert.equal(
    resolveAuthUrls({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    }).appUrl,
    "http://localhost:3000",
  );
  assert.equal(
    resolveAuthUrls({
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000",
    }).appUrl,
    "http://127.0.0.1:3000",
  );
  assert.throws(
    () =>
      resolveAuthUrls({
        NODE_ENV: "production",
        RENDER_EXTERNAL_URL: "https://quenue-pilot.onrender.com",
        NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      }),
    /must use HTTPS in production/,
  );
  assert.throws(
    () =>
      resolveAuthUrls({
        NODE_ENV: "production",
        NEXT_PUBLIC_APP_URL: "http://app.example.com",
      }),
    /must use HTTPS in production/,
  );
});

test("fails closed when no application origin is configured", () => {
  assert.throws(
    () => resolveAuthUrls({ NODE_ENV: "production" }),
    /Set NEXT_PUBLIC_APP_URL or RENDER_EXTERNAL_URL/,
  );
});
