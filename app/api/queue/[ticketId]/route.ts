import { and, eq, ne, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/app/db";
import { z } from "zod";
import {
  departments,
  patientJourneyEvents,
  patientJourneys,
  queueEvents,
  queueTickets,
  queues,
  visits,
} from "@/app/db/schema";
import { getApiOrganizationContext } from "@/app/lib/api-organization";
import { hasPermission } from "@/app/lib/permissions";
import { getQueueTransition } from "@/app/lib/queue-workflow";
import { queueActionSchema } from "@/app/lib/validations";

function getQueueDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ticketId: string }> },
) {
  const result = await getApiOrganizationContext(request);
  if ("response" in result) return result.response;
  if (!hasPermission(result.context.role, "queue:update")) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const { ticketId } = await params;
  if (!z.string().uuid().safeParse(ticketId).success) {
    return NextResponse.json({ error: "Invalid queue ticket ID." }, { status: 400 });
  }
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const parsed = queueActionSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Choose a queue action." },
      { status: 400 },
    );
  }

  const now = new Date();
  const response = await db.transaction(async (transaction) => {
    const [ticket] = await transaction
      .select({
        id: queueTickets.id,
        visitId: queueTickets.visitId,
        patientId: queueTickets.patientId,
        departmentId: queueTickets.departmentId,
        status: queueTickets.status,
      })
      .from(queueTickets)
      .where(
        and(
          eq(queueTickets.id, ticketId),
          eq(queueTickets.organizationId, result.context.organizationId),
        ),
      )
      .for("update")
      .limit(1);

    if (!ticket) {
      return { error: "Queue ticket not found.", status: 404 };
    }

    if (parsed.data.action === "transfer") {
      if (!["waiting", "called", "in_service"].includes(ticket.status)) {
        return { error: "Only active tickets can be transferred.", status: 409 };
      }
      if (ticket.departmentId === parsed.data.departmentId) {
        return { error: "Choose a different department.", status: 400 };
      }

      const [targetDepartment] = await transaction
        .select({
          id: departments.id,
          name: departments.name,
          code: departments.code,
        })
        .from(departments)
        .where(
          and(
            eq(departments.id, parsed.data.departmentId),
            eq(departments.organizationId, result.context.organizationId),
            eq(departments.isActive, true),
          ),
        )
        .limit(1);
      if (!targetDepartment) {
        return { error: "That department is unavailable.", status: 404 };
      }

      const [queue] = await transaction
        .insert(queues)
        .values({
          organizationId: result.context.organizationId,
          departmentId: targetDepartment.id,
          queueDate: getQueueDate(now),
          nextTicketNumber: 2,
        })
        .onConflictDoUpdate({
          target: [
            queues.organizationId,
            queues.departmentId,
            queues.queueDate,
          ],
          set: {
            nextTicketNumber: sql`${queues.nextTicketNumber} + 1`,
          },
        })
        .returning({
          id: queues.id,
          nextTicketNumber: queues.nextTicketNumber,
        });
      const ticketNumber = queue.nextTicketNumber - 1;
      const [newTicket] = await transaction
        .insert(queueTickets)
        .values({
          organizationId: result.context.organizationId,
          queueId: queue.id,
          departmentId: targetDepartment.id,
          patientId: ticket.patientId,
          visitId: ticket.visitId,
          ticketNumber,
          createdBy: result.context.userId,
        })
        .returning({ id: queueTickets.id });

      await transaction
        .update(queueTickets)
        .set({ status: "transferred", transferredAt: now })
        .where(
          and(
            eq(queueTickets.id, ticket.id),
            eq(queueTickets.organizationId, result.context.organizationId),
          ),
        );
      await transaction
        .update(visits)
        .set({ status: "waiting" })
        .where(
          and(
            eq(visits.id, ticket.visitId),
            eq(visits.organizationId, result.context.organizationId),
          ),
        );
      await transaction.insert(queueEvents).values([
        {
          organizationId: result.context.organizationId,
          visitId: ticket.visitId,
          ticketId: ticket.id,
          actorUserId: result.context.userId,
          eventType: "transferred_out",
          details: { departmentId: targetDepartment.id },
        },
        {
          organizationId: result.context.organizationId,
          visitId: ticket.visitId,
          ticketId: newTicket.id,
          actorUserId: result.context.userId,
          eventType: "transferred_in",
          details: { departmentId: ticket.departmentId },
        },
      ]);
      const [journey] = await transaction
        .select({ id: patientJourneys.id })
        .from(patientJourneys)
        .where(
          and(
            eq(patientJourneys.visitId, ticket.visitId),
            eq(patientJourneys.organizationId, result.context.organizationId),
          ),
        )
        .limit(1);
      if (journey) {
        await transaction.insert(patientJourneyEvents).values({
          organizationId: result.context.organizationId,
          journeyId: journey.id,
          departmentId: targetDepartment.id,
          actorUserId: result.context.userId,
          eventType: "transferred",
          details: { ticketNumber, department: targetDepartment.name },
        });
      }
      return {
        ticket: {
          id: newTicket.id,
          department: targetDepartment.name,
          ticketNumber,
          ticketLabel: `${targetDepartment.code}-${String(ticketNumber).padStart(3, "0")}`,
          status: "waiting",
        },
      };
    }

    const nextStatus = getQueueTransition(ticket.status, parsed.data.action);
    if (!nextStatus) {
      return {
        error: `Cannot ${parsed.data.action} a ticket that is ${ticket.status}.`,
        status: 409,
      };
    }

    await transaction
      .update(queueTickets)
      .set({
        status: nextStatus,
        ...(parsed.data.action === "call" ? { calledAt: now } : {}),
        ...(parsed.data.action === "start" ? { startedAt: now } : {}),
        ...(parsed.data.action === "complete" ? { completedAt: now } : {}),
      })
      .where(
        and(
          eq(queueTickets.id, ticket.id),
          eq(queueTickets.organizationId, result.context.organizationId),
        ),
      );

    if (parsed.data.action === "start") {
      await transaction
        .update(visits)
        .set({ status: "in_service" })
        .where(
          and(
            eq(visits.id, ticket.visitId),
            eq(visits.organizationId, result.context.organizationId),
          ),
        );
    }

    if (parsed.data.action === "complete") {
      const [activeTicket] = await transaction
        .select({ id: queueTickets.id })
        .from(queueTickets)
        .where(
          and(
            eq(queueTickets.visitId, ticket.visitId),
            eq(queueTickets.organizationId, result.context.organizationId),
            ne(queueTickets.id, ticket.id),
            sql`${queueTickets.status} IN ('waiting', 'called', 'in_service')`,
          ),
        )
        .limit(1);
      if (!activeTicket) {
        await transaction
          .update(visits)
          .set({ status: "completed", completedAt: now })
          .where(
            and(
              eq(visits.id, ticket.visitId),
              eq(visits.organizationId, result.context.organizationId),
            ),
          );
        await transaction
          .update(patientJourneys)
          .set({ completedAt: now })
          .where(
            and(
              eq(patientJourneys.visitId, ticket.visitId),
              eq(patientJourneys.organizationId, result.context.organizationId),
            ),
          );
      }
    }

    await transaction.insert(queueEvents).values({
      organizationId: result.context.organizationId,
      visitId: ticket.visitId,
      ticketId: ticket.id,
      actorUserId: result.context.userId,
      eventType: parsed.data.action,
    });
    const [journey] = await transaction
      .select({ id: patientJourneys.id })
      .from(patientJourneys)
      .where(
        and(
          eq(patientJourneys.visitId, ticket.visitId),
          eq(patientJourneys.organizationId, result.context.organizationId),
        ),
      )
      .limit(1);
    if (journey) {
      await transaction.insert(patientJourneyEvents).values({
        organizationId: result.context.organizationId,
        journeyId: journey.id,
        departmentId: ticket.departmentId,
        actorUserId: result.context.userId,
        eventType: parsed.data.action,
      });
    }
    return { ticket: { id: ticket.id, status: nextStatus } };
  });

  if ("error" in response) {
    return NextResponse.json(
      { error: response.error },
      { status: response.status },
    );
  }
  return NextResponse.json(response);
}
