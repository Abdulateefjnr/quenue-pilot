// @ts-check

/**
 * @typedef {"call" | "start" | "complete"} QueueTransitionAction
 * @typedef {"waiting" | "called" | "in_service"} ActiveQueueStatus
 * @typedef {"called" | "in_service" | "completed"} QueueTransitionStatus
 */

/** @type {Record<QueueTransitionAction, { from: ActiveQueueStatus; to: QueueTransitionStatus }>} */
const transitions = {
  call: { from: "waiting", to: "called" },
  start: { from: "called", to: "in_service" },
  complete: { from: "in_service", to: "completed" },
};

/**
 * @param {string} status
 * @param {QueueTransitionAction} action
 * @returns {QueueTransitionStatus | null}
 */
function getQueueTransition(status, action) {
  const transition = transitions[action];
  return status === transition.from ? transition.to : null;
}

module.exports = { getQueueTransition };
