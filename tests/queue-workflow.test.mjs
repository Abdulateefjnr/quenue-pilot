import assert from "node:assert/strict";
import { test } from "node:test";
import queueWorkflow from "../app/lib/queue-workflow.js";

const { getQueueTransition } = queueWorkflow;

test("queue tickets follow waiting, called, in-service, completed transitions", () => {
  assert.equal(getQueueTransition("waiting", "call"), "called");
  assert.equal(getQueueTransition("called", "start"), "in_service");
  assert.equal(getQueueTransition("in_service", "complete"), "completed");
});

test("queue workflow rejects skipped and repeated transitions", () => {
  assert.equal(getQueueTransition("waiting", "start"), null);
  assert.equal(getQueueTransition("called", "call"), null);
  assert.equal(getQueueTransition("completed", "complete"), null);
});
