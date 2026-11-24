import assert from "node:assert/strict";
import { test } from "node:test";
import appointmentWorkflow from "../app/lib/appointment-workflow.js";

const {
  appointmentWindowsOverlap,
  getAppointmentTransition,
  isAppointmentWindowValid,
} =
  appointmentWorkflow;

test("appointments allow only valid lifecycle transitions", () => {
  assert.equal(getAppointmentTransition("scheduled", "confirm"), "confirmed");
  assert.equal(getAppointmentTransition("confirmed", "check_in"), "checked_in");
  assert.equal(getAppointmentTransition("checked_in", "complete"), "completed");
  assert.equal(getAppointmentTransition("scheduled", "cancel"), "cancelled");
  assert.equal(getAppointmentTransition("confirmed", "no_show"), "no_show");
});

test("appointments reject repeated and skipped lifecycle transitions", () => {
  assert.equal(getAppointmentTransition("scheduled", "complete"), null);
  assert.equal(getAppointmentTransition("completed", "complete"), null);
  assert.equal(getAppointmentTransition("cancelled", "confirm"), null);
});

test("appointment window overlap includes containment but permits adjacent bookings", () => {
  const existing = {
    startsAt: new Date("2026-11-16T09:00:00Z"),
    endsAt: new Date("2026-11-16T10:00:00Z"),
  };
  assert.equal(
    appointmentWindowsOverlap(
      {
        startsAt: new Date("2026-11-16T09:15:00Z"),
        endsAt: new Date("2026-11-16T09:30:00Z"),
      },
      existing,
    ),
    true,
  );
  assert.equal(
    appointmentWindowsOverlap(
      {
        startsAt: new Date("2026-11-16T10:00:00Z"),
        endsAt: new Date("2026-11-16T10:30:00Z"),
      },
      existing,
    ),
    false,
  );
});

test("appointment window validation rejects reversed and overlong bookings", () => {
  assert.equal(
    isAppointmentWindowValid({
      startsAt: "2026-11-16T09:00:00.000Z",
      endsAt: "2026-11-16T09:30:00.000Z",
    }),
    true,
  );
  assert.equal(
    isAppointmentWindowValid({
      startsAt: "2026-11-16T09:30:00.000Z",
      endsAt: "2026-11-16T09:00:00.000Z",
    }),
    false,
  );
  assert.equal(
    isAppointmentWindowValid({
      startsAt: "2026-11-16T09:00:00.000Z",
      endsAt: "2026-11-16T18:00:00.000Z",
    }),
    false,
  );
});
