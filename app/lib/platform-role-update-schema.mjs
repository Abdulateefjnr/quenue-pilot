import { z } from "zod";

export const platformRoleUpdateSchema = z.union([
  z.object({
    scope: z.literal("platform"),
    userId: z.string().min(1).max(128),
    role: z.literal("user"),
  }),
  z.object({
    scope: z.literal("platform"),
    userId: z.string().min(1).max(128),
    role: z.literal("admin"),
    organizationType: z.enum(["hospital", "clinic"]),
  }),
  z.object({
    scope: z.literal("facility"),
    userId: z.string().min(1).max(128),
    organizationId: z.string().min(1).max(128),
    role: z.enum(["admin", "doctor", "nurse", "receptionist", "patient"]),
  }),
]);
