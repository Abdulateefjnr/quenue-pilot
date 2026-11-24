"use client";

import {
  createRealtimeClient,
  type RealtimeClient,
  type SealedLiveQuery,
} from "@neon/realtime/client";
import { useEffect, useState } from "react";
import { formatFacilityTimestamp } from "@/app/lib/facility-time";
import { readJsonResponse } from "@/app/lib/client-json-response.mjs";

export type DashboardNotification = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
};

type RealtimeNotification = Omit<DashboardNotification, "createdAt"> & {
  created_at: Date | string;
};

let client: RealtimeClient | undefined;
let clientUrl: string | undefined;

function getClient(url: string) {
  if (!client || clientUrl !== url) {
    client?.close();
    client = createRealtimeClient({ url });
    clientUrl = url;
  }
  return client;
}

export default function LiveNotifications({
  initialNotifications,
}: {
  initialNotifications: DashboardNotification[];
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [status, setStatus] = useState("Connecting to live updates…");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let renewalTimer: ReturnType<typeof setTimeout> | undefined;
    let stopListening: (() => void) | undefined;
    let stopSubscription: (() => void) | undefined;

    async function subscribe() {
      try {
        const response = await fetch("/api/realtime/notifications", {
          cache: "no-store",
        });
        const result = await readJsonResponse<
          | {
              query: SealedLiveQuery<RealtimeNotification>;
              url: string;
            }
          | { error: string }
        >(response, "Live updates are unavailable.");

        if (!("query" in result)) {
          throw new Error("error" in result ? result.error : "Live updates are unavailable.");
        }

        if (!active) return;

        const liveClient = getClient(result.url);
        const subscription = liveClient.subscribe(result.query);
        stopSubscription = () => subscription.unsubscribe();
        stopListening = subscription.onChange((snapshot) => {
          if (!active) return;
          if (snapshot.error) {
            setError(snapshot.error.message);
            setStatus("Live updates paused");
          } else if (snapshot.data) {
            setNotifications(
              snapshot.data.map((item) => ({
                ...item,
                createdAt: new Date(item.created_at).toISOString(),
              })),
            );
            setError("");
            setStatus(snapshot.status);
          }
        });

        const renewQuery = async () => {
          try {
            const renewalResponse = await fetch("/api/realtime/notifications", {
              cache: "no-store",
            });
            const renewal = await readJsonResponse<
              | {
                  query: SealedLiveQuery<RealtimeNotification>;
                  url: string;
                }
              | { error: string }
            >(renewalResponse, "Could not renew live updates.");

            if (!("query" in renewal)) {
              throw new Error(
                "error" in renewal ? renewal.error : "Could not renew live updates.",
              );
            }
            await subscription.renew(renewal.query);
            setError("");
          } catch (renewalError) {
            if (active) {
              setError(
                renewalError instanceof Error
                  ? renewalError.message
                  : "Could not renew live updates.",
              );
            }
          } finally {
            if (active) {
              renewalTimer = setTimeout(renewQuery, 120_000);
            }
          }
        };

        renewalTimer = setTimeout(renewQuery, 120_000);
      } catch (subscriptionError) {
        if (active) {
          setStatus("Live updates unavailable");
          setError(
            subscriptionError instanceof Error
              ? subscriptionError.message
              : "Could not connect to live updates.",
          );
        }
      }
    }

    void subscribe();

    return () => {
      active = false;
      if (renewalTimer) clearTimeout(renewalTimer);
      stopListening?.();
      stopSubscription?.();
    };
  }, []);

  return (
    <section aria-labelledby="notifications-heading" className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 id="notifications-heading" className="text-lg font-semibold text-slate-900">
          Notifications
        </h2>
        <span className="text-xs text-slate-500" aria-live="polite">
          {status}
        </span>
      </div>
      {error && <p role="status" className="text-sm text-amber-800">{error}</p>}
      {notifications.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          You&apos;re all caught up.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {notifications.map((notification) => (
            <li key={notification.id} className="p-4">
              <p className="font-medium text-slate-900">{notification.title}</p>
              <p className="mt-1 text-sm text-slate-600">{notification.body}</p>
              <time
                className="mt-2 block text-xs text-slate-500"
                dateTime={notification.createdAt}
              >
                {formatFacilityTimestamp(new Date(notification.createdAt))}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
