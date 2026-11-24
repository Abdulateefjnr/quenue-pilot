CREATE UNIQUE INDEX "patient_journeys_organization_id_unique" ON "patient_journeys" USING btree ("organization_id","id");--> statement-breakpoint
ALTER TABLE "patient_journey_events" DROP CONSTRAINT "patient_journey_events_journey_id_patient_journeys_id_fk";
--> statement-breakpoint
ALTER TABLE "patient_journey_events" ADD CONSTRAINT "patient_journey_events_organization_journey_fk" FOREIGN KEY ("organization_id","journey_id") REFERENCES "public"."patient_journeys"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_journey_events" ADD CONSTRAINT "patient_journey_events_organization_department_fk" FOREIGN KEY ("organization_id","department_id") REFERENCES "public"."departments"("organization_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "queues_organization_id_department_unique" ON "queues" USING btree ("organization_id","id","department_id");--> statement-breakpoint
INSERT INTO "departments" ("organization_id", "name", "code")
SELECT "id", 'General', 'GEN'
FROM "organization"
ON CONFLICT ("organization_id", "code") DO NOTHING;