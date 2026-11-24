CREATE TYPE "public"."queue_ticket_status" AS ENUM('waiting', 'called', 'in_service', 'transferred', 'completed', 'skipped', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."visit_status" AS ENUM('waiting', 'in_service', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "departments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_journey_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"journey_id" uuid NOT NULL,
	"department_id" uuid,
	"actor_user_id" text NOT NULL,
	"event_type" text NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patient_journeys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"visit_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"medical_record_number" text NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"normalized_phone" text,
	"date_of_birth" date,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "queue_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"visit_id" uuid NOT NULL,
	"ticket_id" uuid NOT NULL,
	"actor_user_id" text NOT NULL,
	"event_type" text NOT NULL,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "queue_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"queue_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"visit_id" uuid NOT NULL,
	"ticket_number" integer NOT NULL,
	"status" "queue_ticket_status" DEFAULT 'waiting' NOT NULL,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"called_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"transferred_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "queues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"department_id" uuid NOT NULL,
	"queue_date" date NOT NULL,
	"next_ticket_number" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"patient_id" uuid NOT NULL,
	"status" "visit_status" DEFAULT 'waiting' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "departments_organization_code_unique" ON "departments" USING btree ("organization_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "departments_organization_id_unique" ON "departments" USING btree ("organization_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "patient_journeys_visit_unique" ON "patient_journeys" USING btree ("visit_id");--> statement-breakpoint
CREATE UNIQUE INDEX "patients_organization_mrn_unique" ON "patients" USING btree ("organization_id","medical_record_number");--> statement-breakpoint
CREATE UNIQUE INDEX "patients_organization_id_unique" ON "patients" USING btree ("organization_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "queue_tickets_queue_number_unique" ON "queue_tickets" USING btree ("organization_id","queue_id","ticket_number");--> statement-breakpoint
CREATE UNIQUE INDEX "queue_tickets_organization_id_unique" ON "queue_tickets" USING btree ("organization_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "queues_department_date_unique" ON "queues" USING btree ("organization_id","department_id","queue_date");--> statement-breakpoint
CREATE UNIQUE INDEX "queues_organization_id_unique" ON "queues" USING btree ("organization_id","id");--> statement-breakpoint
CREATE UNIQUE INDEX "visits_organization_id_unique" ON "visits" USING btree ("organization_id","id");--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_journey_events" ADD CONSTRAINT "patient_journey_events_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_journey_events" ADD CONSTRAINT "patient_journey_events_journey_id_patient_journeys_id_fk" FOREIGN KEY ("journey_id") REFERENCES "public"."patient_journeys"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_journey_events" ADD CONSTRAINT "patient_journey_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_journeys" ADD CONSTRAINT "patient_journeys_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_journeys" ADD CONSTRAINT "patient_journeys_organization_visit_fk" FOREIGN KEY ("organization_id","visit_id") REFERENCES "public"."visits"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_journeys" ADD CONSTRAINT "patient_journeys_organization_patient_fk" FOREIGN KEY ("organization_id","patient_id") REFERENCES "public"."patients"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_events" ADD CONSTRAINT "queue_events_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_events" ADD CONSTRAINT "queue_events_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_events" ADD CONSTRAINT "queue_events_organization_visit_fk" FOREIGN KEY ("organization_id","visit_id") REFERENCES "public"."visits"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_events" ADD CONSTRAINT "queue_events_organization_ticket_fk" FOREIGN KEY ("organization_id","ticket_id") REFERENCES "public"."queue_tickets"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_tickets" ADD CONSTRAINT "queue_tickets_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_tickets" ADD CONSTRAINT "queue_tickets_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_tickets" ADD CONSTRAINT "queue_tickets_organization_queue_fk" FOREIGN KEY ("organization_id","queue_id") REFERENCES "public"."queues"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_tickets" ADD CONSTRAINT "queue_tickets_organization_department_fk" FOREIGN KEY ("organization_id","department_id") REFERENCES "public"."departments"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_tickets" ADD CONSTRAINT "queue_tickets_organization_patient_fk" FOREIGN KEY ("organization_id","patient_id") REFERENCES "public"."patients"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queue_tickets" ADD CONSTRAINT "queue_tickets_organization_visit_fk" FOREIGN KEY ("organization_id","visit_id") REFERENCES "public"."visits"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queues" ADD CONSTRAINT "queues_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "queues" ADD CONSTRAINT "queues_organization_department_fk" FOREIGN KEY ("organization_id","department_id") REFERENCES "public"."departments"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "visits" ADD CONSTRAINT "visits_organization_patient_fk" FOREIGN KEY ("organization_id","patient_id") REFERENCES "public"."patients"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "patient_journey_events_journey_created_idx" ON "patient_journey_events" USING btree ("organization_id","journey_id","created_at");--> statement-breakpoint
CREATE INDEX "patients_organization_name_idx" ON "patients" USING btree ("organization_id","full_name");--> statement-breakpoint
CREATE INDEX "patients_organization_phone_idx" ON "patients" USING btree ("organization_id","normalized_phone");--> statement-breakpoint
CREATE INDEX "queue_events_visit_created_idx" ON "queue_events" USING btree ("organization_id","visit_id","created_at");--> statement-breakpoint
CREATE INDEX "queue_tickets_department_status_idx" ON "queue_tickets" USING btree ("organization_id","department_id","status","queued_at");--> statement-breakpoint
CREATE INDEX "queue_tickets_visit_idx" ON "queue_tickets" USING btree ("organization_id","visit_id");--> statement-breakpoint
CREATE INDEX "visits_organization_status_created_idx" ON "visits" USING btree ("organization_id","status","created_at");