import assert from "node:assert/strict";
import { test } from "node:test";
import { readJsonResponse } from "../app/lib/client-json-response.mjs";

test("reports the HTTP status for an empty error response", async () => {
  const response = new Response(null, { status: 500 });

  await assert.rejects(
    readJsonResponse(response, "Could not load appointments."),
    /Could not load appointments\. \(HTTP 500\)/,
  );
});

test("preserves a JSON error message from the server", async () => {
  const response = Response.json({ error: "Authentication required." }, { status: 401 });

  await assert.rejects(
    readJsonResponse(response, "Could not load appointments."),
    /Authentication required\./,
  );
});

test("reports invalid JSON for a successful response", async () => {
  const response = new Response("", {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

  await assert.rejects(
    readJsonResponse(response, "Could not load appointments."),
    /invalid JSON response/,
  );
});
