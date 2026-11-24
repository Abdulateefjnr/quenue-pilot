// @ts-check

/**
 * @typedef {"scheduled" | "confirmed" | "checked_in" | "completed" | "cancelled" | "no_show"} AppointmentStatus
 * @typedef {"confirm" | "check_in" | "complete" | "cancel" | "no_show"} AppointmentAction
 */

/** @type {Record<AppointmentAction, { from: AppointmentStatus[]; to: AppointmentStatus }>} */
const transitions = {
  confirm: { from: ["scheduled"], to: "confirmed" },
  check_in: { from: ["scheduled", "confirmed"], to: "checked_in" },
  complete: { from: ["checked_in"], to: "completed" },
  cancel: { from: ["scheduled", "confirmed"], to: "cancelled" },
  no_show: { from: ["scheduled", "confirmed"], to: "no_show" },
};

/**
 * @param {AppointmentStatus} status
 * @param {AppointmentAction} action
 * @returns {AppointmentStatus | null}
 */
function getAppointmentTransition(status, action) {
  const transition = transitions[action];
  return transition.from.includes(status) ? transition.to : null;
}

/**
 * @param {{ startsAt: Date; endsAt: Date }} candidate
 * @param {{ startsAt: Date; endsAt: Date }} existing
 */
function appointmentWindowsOverlap(candidate, existing) {
  return candidate.startsAt < existing.endsAt && candidate.endsAt > existing.startsAt;
}

/**
 * @param {{ startsAt: string; endsAt: string }} value
 */
function isAppointmentWindowValid(value) {
  const startsAt = Date.parse(value.startsAt);
  const endsAt = Date.parse(value.endsAt);
  return (
    Number.isFinite(startsAt) &&
    Number.isFinite(endsAt) &&
    endsAt > startsAt &&
    endsAt - startsAt <= 8 * 60 * 60 * 1000
  );
}

module.exports = {
  getAppointmentTransition,
  appointmentWindowsOverlap,
  isAppointmentWindowValid,
};
