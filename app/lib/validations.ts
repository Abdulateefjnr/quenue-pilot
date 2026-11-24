import { z } from "zod";
import { isAppointmentWindowValid } from "@/app/lib/appointment-workflow.js";
import { platformRoleUpdateSchema } from "./platform-role-update-schema.mjs";

export { platformRoleUpdateSchema };

const strongPassword = z
  .string()
  .min(12, "Use at least 12 characters for your password.")
  .max(128, "Password must be 128 characters or fewer.")
  .regex(/[a-z]/, "Include a lowercase letter.")
  .regex(/[A-Z]/, "Include an uppercase letter.")
  .regex(/[0-9]/, "Include a number.")
  .regex(/[^A-Za-z0-9]/, "Include a symbol.");

export const passwordSchema = strongPassword;

export const registrationSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    organizationName: z.string().trim().min(2).max(120),
    email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
    phone: z
      .string()
      .trim()
      .max(30, "Phone number must be 30 characters or fewer.")
      .optional()
      .or(z.literal("")),
    password: strongPassword,
    confirmPassword: z.string(),
    termsAccepted: z.literal(true),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export const onboardingSchema = z.object({
  organizationName: z.string().trim().min(2).max(120),
  organizationType: z.enum(["hospital", "clinic"]),
  phone: z
    .string()
    .trim()
    .max(30, "Phone number must be 30 characters or fewer.")
    .optional()
    .or(z.literal("")),
  termsAccepted: z.literal(true),
});

export const organizationProfileSchema = z.object({
  organizationName: z.string().trim().min(2, "Enter a facility name.").max(120),
  organizationType: z.enum(["hospital", "clinic"]),
  phone: z
    .string()
    .trim()
    .max(30, "Phone number must be 30 characters or fewer.")
    .optional()
    .or(z.literal("")),
});

function isValidDateOfBirth(value: string) {
  const parsed = Date.parse(value);
  if (
    !Number.isFinite(parsed) ||
    new Date(parsed).toISOString().slice(0, 10) !== value
  ) {
    return false;
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts.map(({ type, value: partValue }) => [type, partValue]),
  );
  const today = `${values.year}-${values.month}-${values.day}`;
  return value <= today;
}

export const patientCheckInSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the patient's full name.").max(120),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date of birth.")
    .refine(isValidDateOfBirth, "Enter a valid date of birth.")
    .optional()
    .or(z.literal("")),
  departmentId: z.string().uuid("Select a valid department."),
});

export const departmentSchema = z.object({
  name: z.string().trim().min(2, "Enter a department name.").max(80),
  code: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9]{2,6}$/, "Use a 2–6 character department code.")
    .transform((value) => value.toUpperCase()),
});

export const queueActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("call") }),
  z.object({ action: z.literal("start") }),
  z.object({ action: z.literal("complete") }),
  z.object({
    action: z.literal("transfer"),
    departmentId: z.string().uuid(),
  }),
]);

const appointmentWindowFields = z.object({
  patientId: z.string().uuid("Select a valid patient."),
  departmentId: z.string().uuid("Select a valid department."),
  assignedStaffId: z.string().min(1).max(128).nullable(),
  startsAt: z.iso.datetime({ offset: true }),
  endsAt: z.iso.datetime({ offset: true }),
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});

export const appointmentCreateSchema = appointmentWindowFields
  .extend({ idempotencyKey: z.string().uuid() })
  .refine(isAppointmentWindowValid, {
    message: "The end time must be after the start time and no more than 8 hours later.",
    path: ["endsAt"],
  });

export const appointmentUpdateSchema = appointmentWindowFields.refine(
  isAppointmentWindowValid,
  {
    message: "The end time must be after the start time and no more than 8 hours later.",
    path: ["endsAt"],
  },
);

export const appointmentStatusActionSchema = z.object({
  action: z.enum(["confirm", "check_in", "complete", "cancel", "no_show"]),
});

export const passwordResetSchema = z
  .object({
    newPassword: strongPassword,
    confirmPassword: z.string(),
    token: z.string().min(1),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export function slugifyOrganizationName(name: string) {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

  return slug || "organization";
}
