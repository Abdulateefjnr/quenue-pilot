export type AppointmentStatus =
  | "scheduled"
  | "confirmed"
  | "checked_in"
  | "completed"
  | "cancelled"
  | "no_show";
export type AppointmentAction =
  | "confirm"
  | "check_in"
  | "complete"
  | "cancel"
  | "no_show";

export function getAppointmentTransition(
  status: AppointmentStatus,
  action: AppointmentAction,
): AppointmentStatus | null;
export function appointmentWindowsOverlap(
  candidate: { startsAt: Date; endsAt: Date },
  existing: { startsAt: Date; endsAt: Date },
): boolean;
export function isAppointmentWindowValid(value: {
  startsAt: string;
  endsAt: string;
}): boolean;
