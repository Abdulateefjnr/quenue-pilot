import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  pgEnum,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import * as authSchema from "./auth-schema";

export * from "./auth-schema";

export const pendingOrganizations = pgTable("pending_organizations", {
  email: text("email").primaryKey(),
  userId: text("user_id").references(() => authSchema.user.id, {
    onDelete: "cascade",
  }),
  name: text("name").notNull(),
  organizationType: text("organization_type"),
  contactPhone: text("contact_phone"),
  termsAcceptedAt: timestamp("terms_accepted_at", {
    withTimezone: true,
  }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const organizationProfiles = pgTable("organization_profiles", {
  organizationId: text("organization_id")
    .primaryKey()
    .references(() => authSchema.organization.id, { onDelete: "cascade" }),
  organizationType: text("organization_type").notNull(),
  contactPhone: text("contact_phone"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const notifications = pgTable("notifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => authSchema.user.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const securityEvents = pgTable("security_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id").references(() => authSchema.user.id, {
    onDelete: "set null",
  }),
  eventType: text("event_type").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const authRateLimits = pgTable("auth_rate_limits", {
  identifier: text("identifier").primaryKey(),
  count: integer("count").notNull(),
  windowStartedAt: timestamp("window_started_at", {
    withTimezone: true,
  }).notNull(),
});

export const visitStatus = pgEnum("visit_status", [
  "waiting",
  "in_service",
  "completed",
  "cancelled",
]);

export const queueTicketStatus = pgEnum("queue_ticket_status", [
  "waiting",
  "called",
  "in_service",
  "transferred",
  "completed",
  "skipped",
  "cancelled",
]);

export const appointmentStatus = pgEnum("appointment_status", [
  "scheduled",
  "confirmed",
  "checked_in",
  "completed",
  "cancelled",
  "no_show",
]);

export const departments = pgTable(
  "departments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => authSchema.organization.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    code: text("code").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("departments_organization_code_unique").on(
      table.organizationId,
      table.code,
    ),
    uniqueIndex("departments_organization_id_unique").on(
      table.organizationId,
      table.id,
    ),
  ],
);

export const patients = pgTable(
  "patients",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => authSchema.organization.id, { onDelete: "cascade" }),
    medicalRecordNumber: text("medical_record_number").notNull(),
    fullName: text("full_name").notNull(),
    phone: text("phone"),
    normalizedPhone: text("normalized_phone"),
    dateOfBirth: date("date_of_birth", { mode: "string" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => authSchema.user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("patients_organization_mrn_unique").on(
      table.organizationId,
      table.medicalRecordNumber,
    ),
    uniqueIndex("patients_organization_id_unique").on(
      table.organizationId,
      table.id,
    ),
    index("patients_organization_name_idx").on(
      table.organizationId,
      table.fullName,
    ),
    index("patients_organization_phone_idx").on(
      table.organizationId,
      table.normalizedPhone,
    ),
  ],
);

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => authSchema.organization.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id").notNull(),
    departmentId: uuid("department_id").notNull(),
    assignedStaffId: text("assigned_staff_id").references(() => authSchema.user.id, {
      onDelete: "set null",
    }),
    idempotencyKey: text("idempotency_key"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: appointmentStatus("status").default("scheduled").notNull(),
    reason: text("reason"),
    createdBy: text("created_by")
      .notNull()
      .references(() => authSchema.user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      columns: [table.organizationId, table.patientId],
      foreignColumns: [patients.organizationId, patients.id],
      name: "appointments_organization_patient_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.organizationId, table.departmentId],
      foreignColumns: [departments.organizationId, departments.id],
      name: "appointments_organization_department_fk",
    }).onDelete("restrict"),
    uniqueIndex("appointments_organization_id_unique").on(
      table.organizationId,
      table.id,
    ),
    uniqueIndex("appointments_idempotency_unique").on(
      table.organizationId,
      table.idempotencyKey,
    ),
    index("appointments_organization_start_idx").on(
      table.organizationId,
      table.startsAt,
    ),
    index("appointments_patient_start_idx").on(
      table.organizationId,
      table.patientId,
      table.startsAt,
    ),
    index("appointments_staff_start_idx").on(
      table.organizationId,
      table.assignedStaffId,
      table.startsAt,
    ),
    check("appointments_valid_window", sql`${table.endsAt} > ${table.startsAt}`),
  ],
);

export const appointmentEvents = pgTable(
  "appointment_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => authSchema.organization.id, { onDelete: "cascade" }),
    appointmentId: uuid("appointment_id").notNull(),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => authSchema.user.id, { onDelete: "restrict" }),
    eventType: text("event_type").notNull(),
    details: jsonb("details").$type<Record<string, string | number | null>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.organizationId, table.appointmentId],
      foreignColumns: [appointments.organizationId, appointments.id],
      name: "appointment_events_organization_appointment_fk",
    }).onDelete("cascade"),
    index("appointment_events_appointment_created_idx").on(
      table.organizationId,
      table.appointmentId,
      table.createdAt,
    ),
  ],
);

export const visits = pgTable(
  "visits",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => authSchema.organization.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id").notNull(),
    status: visitStatus("status").default("waiting").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => authSchema.user.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      columns: [table.organizationId, table.patientId],
      foreignColumns: [patients.organizationId, patients.id],
      name: "visits_organization_patient_fk",
    }).onDelete("restrict"),
    uniqueIndex("visits_organization_id_unique").on(
      table.organizationId,
      table.id,
    ),
    index("visits_organization_status_created_idx").on(
      table.organizationId,
      table.status,
      table.createdAt,
    ),
  ],
);

export const queues = pgTable(
  "queues",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => authSchema.organization.id, { onDelete: "cascade" }),
    departmentId: uuid("department_id").notNull(),
    queueDate: date("queue_date", { mode: "string" }).notNull(),
    nextTicketNumber: integer("next_ticket_number").default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.organizationId, table.departmentId],
      foreignColumns: [departments.organizationId, departments.id],
      name: "queues_organization_department_fk",
    }).onDelete("restrict"),
    uniqueIndex("queues_department_date_unique").on(
      table.organizationId,
      table.departmentId,
      table.queueDate,
    ),
    uniqueIndex("queues_organization_id_unique").on(
      table.organizationId,
      table.id,
    ),
    uniqueIndex("queues_organization_id_department_unique").on(
      table.organizationId,
      table.id,
      table.departmentId,
    ),
  ],
);

export const queueTickets = pgTable(
  "queue_tickets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => authSchema.organization.id, { onDelete: "cascade" }),
    queueId: uuid("queue_id").notNull(),
    departmentId: uuid("department_id").notNull(),
    patientId: uuid("patient_id").notNull(),
    visitId: uuid("visit_id").notNull(),
    ticketNumber: integer("ticket_number").notNull(),
    status: queueTicketStatus("status").default("waiting").notNull(),
    queuedAt: timestamp("queued_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    calledAt: timestamp("called_at", { withTimezone: true }),
    startedAt: timestamp("started_at", { withTimezone: true }),
    transferredAt: timestamp("transferred_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdBy: text("created_by")
      .notNull()
      .references(() => authSchema.user.id, { onDelete: "restrict" }),
  },
  (table) => [
    foreignKey({
      columns: [table.organizationId, table.queueId],
      foreignColumns: [queues.organizationId, queues.id],
      name: "queue_tickets_organization_queue_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.organizationId, table.departmentId],
      foreignColumns: [departments.organizationId, departments.id],
      name: "queue_tickets_organization_department_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.organizationId, table.patientId],
      foreignColumns: [patients.organizationId, patients.id],
      name: "queue_tickets_organization_patient_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.organizationId, table.visitId],
      foreignColumns: [visits.organizationId, visits.id],
      name: "queue_tickets_organization_visit_fk",
    }).onDelete("restrict"),
    uniqueIndex("queue_tickets_queue_number_unique").on(
      table.organizationId,
      table.queueId,
      table.ticketNumber,
    ),
    uniqueIndex("queue_tickets_organization_id_unique").on(
      table.organizationId,
      table.id,
    ),
    index("queue_tickets_department_status_idx").on(
      table.organizationId,
      table.departmentId,
      table.status,
      table.queuedAt,
    ),
    index("queue_tickets_visit_idx").on(table.organizationId, table.visitId),
  ],
);

export const queueEvents = pgTable(
  "queue_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => authSchema.organization.id, { onDelete: "cascade" }),
    visitId: uuid("visit_id").notNull(),
    ticketId: uuid("ticket_id").notNull(),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => authSchema.user.id, { onDelete: "restrict" }),
    eventType: text("event_type").notNull(),
    details: jsonb("details").$type<Record<string, string | number | null>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.organizationId, table.visitId],
      foreignColumns: [visits.organizationId, visits.id],
      name: "queue_events_organization_visit_fk",
    }).onDelete("restrict"),
    foreignKey({
      columns: [table.organizationId, table.ticketId],
      foreignColumns: [queueTickets.organizationId, queueTickets.id],
      name: "queue_events_organization_ticket_fk",
    }).onDelete("restrict"),
    index("queue_events_visit_created_idx").on(
      table.organizationId,
      table.visitId,
      table.createdAt,
    ),
  ],
);

export const patientJourneys = pgTable(
  "patient_journeys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => authSchema.organization.id, { onDelete: "cascade" }),
    visitId: uuid("visit_id").notNull(),
    patientId: uuid("patient_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      columns: [table.organizationId, table.visitId],
      foreignColumns: [visits.organizationId, visits.id],
      name: "patient_journeys_organization_visit_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.organizationId, table.patientId],
      foreignColumns: [patients.organizationId, patients.id],
      name: "patient_journeys_organization_patient_fk",
    }).onDelete("restrict"),
    uniqueIndex("patient_journeys_visit_unique").on(table.visitId),
    uniqueIndex("patient_journeys_organization_id_unique").on(
      table.organizationId,
      table.id,
    ),
  ],
);

export const patientJourneyEvents = pgTable(
  "patient_journey_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => authSchema.organization.id, { onDelete: "cascade" }),
    journeyId: uuid("journey_id").notNull(),
    departmentId: uuid("department_id"),
    actorUserId: text("actor_user_id")
      .notNull()
      .references(() => authSchema.user.id, { onDelete: "restrict" }),
    eventType: text("event_type").notNull(),
    details: jsonb("details").$type<Record<string, string | number | null>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.organizationId, table.journeyId],
      foreignColumns: [patientJourneys.organizationId, patientJourneys.id],
      name: "patient_journey_events_organization_journey_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.organizationId, table.departmentId],
      foreignColumns: [departments.organizationId, departments.id],
      name: "patient_journey_events_organization_department_fk",
    }).onDelete("restrict"),
    index("patient_journey_events_journey_created_idx").on(
      table.organizationId,
      table.journeyId,
      table.createdAt,
    ),
  ],
);
