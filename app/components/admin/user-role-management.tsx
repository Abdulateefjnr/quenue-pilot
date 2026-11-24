"use client";

import { useEffect, useState } from "react";
import { readJsonResponse } from "@/app/lib/client-json-response.mjs";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  platformRole: "user" | "admin";
  organizationType: "hospital" | "clinic" | null;
  createdAt: string;
  memberships: FacilityMembership[];
};

type FacilityMembership = {
  organizationId: string;
  organizationName: string;
  role: string;
};

type Facility = {
  organizationId: string;
  name: string;
  organizationType: "hospital" | "clinic";
};

export default function UserRoleManagement({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [selectedFacilityId, setSelectedFacilityId] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<Record<string, "hospital" | "clinic">>({});
  const [selectedFacilityRoles, setSelectedFacilityRoles] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/admin/users", { cache: "no-store" })
      .then(async (response) => {
        const result = await readJsonResponse<{
          users?: AdminUser[];
          facilities?: Facility[];
          error?: string;
        }>(response, "Unable to load users.");
        if (active) {
          const availableFacilities = result.facilities ?? [];
          setUsers(result.users ?? []);
          setFacilities(availableFacilities);
          setSelectedFacilityId(availableFacilities[0]?.organizationId ?? "");
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setErrorMessage(error instanceof Error ? error.message : "Unable to load users.");
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function updateRole(target: AdminUser, role: "user" | "admin") {
    setUpdatingUserId(target.id);
    setErrorMessage("");
    const organizationType =
      selectedTypes[target.id] ?? target.organizationType ?? "hospital";
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "platform",
          userId: target.id,
          role,
          ...(role === "admin" ? { organizationType } : {}),
        }),
      });
      const result = await readJsonResponse<{
        error?: string;
        user?: {
          id: string;
          platformRole: AdminUser["platformRole"];
          organizationType: AdminUser["organizationType"];
        };
      }>(response, "Unable to update the user's role.");
      if (!result.user) {
        throw new Error(result.error ?? "Unable to update the user's role.");
      }
      setUsers((current) =>
        current.map((user) =>
          user.id === result.user?.id
            ? {
                ...user,
                platformRole: result.user.platformRole,
                organizationType: result.user.organizationType,
              }
            : user,
        ),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update the user's role.");
    } finally {
      setUpdatingUserId("");
    }
  }

  async function assignFacilityRole(target: AdminUser) {
    const role = selectedFacilityRoles[`${selectedFacilityId}:${target.id}`];
    if (!selectedFacilityId || !role) {
      setErrorMessage("Choose a facility and a facility role.");
      return;
    }

    setUpdatingUserId(target.id);
    setErrorMessage("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "facility",
          userId: target.id,
          organizationId: selectedFacilityId,
          role,
        }),
      });
      const result = await readJsonResponse<{
        error?: string;
        membership?: { userId: string; organizationId: string; role: string };
      }>(response, "Unable to assign the facility role.");
      const assignedMembership = result.membership;
      if (!assignedMembership) {
        throw new Error(result.error ?? "Unable to assign the facility role.");
      }

      const facilityName =
        facilities.find((facility) => facility.organizationId === selectedFacilityId)?.name ?? "";
      setUsers((current) =>
        current.map((user) => {
          if (user.id !== target.id) return user;
          const currentMemberships = user.memberships.filter(
            (membership) => membership.organizationId !== selectedFacilityId,
          );
          return {
            ...user,
            memberships: [
              ...currentMemberships,
              {
                organizationId: selectedFacilityId,
                organizationName: facilityName,
                role: assignedMembership.role,
              },
            ],
          };
        }),
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to assign the facility role.");
    } finally {
      setUpdatingUserId("");
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {errorMessage && (
        <p role="alert" className="border-b border-red-100 bg-red-50 px-5 py-3 text-sm text-red-800">
          {errorMessage}
        </p>
      )}
      {isLoading ? (
        <p role="status" className="px-5 py-8 text-sm text-slate-600">Loading registered users...</p>
      ) : users.length ? (
        <ul className="divide-y divide-slate-100">
          {users.map((user) => (
            <li key={user.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  {user.name}{user.id === currentUserId ? " (you)" : ""}
                </p>
                <p className="truncate text-sm text-slate-600">{user.email}</p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-700">
                  {user.platformRole === "admin" ? "Super Admin" : "User"}
                </span>
                <label className="sr-only" htmlFor={`facility-type-${user.id}`}>
                  Facility type for {user.email}
                </label>
                <select
                  id={`facility-type-${user.id}`}
                  value={selectedTypes[user.id] ?? user.organizationType ?? "hospital"}
                  onChange={(event) =>
                    setSelectedTypes((current) => ({
                      ...current,
                      [user.id]: event.target.value === "clinic" ? "clinic" : "hospital",
                    }))
                  }
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-700"
                >
                  <option value="hospital">Hospital</option>
                  <option value="clinic">Clinic</option>
                </select>
                {user.platformRole === "admin" ? (
                  <>
                    <button
                      type="button"
                      disabled={updatingUserId === user.id}
                      onClick={() => void updateRole(user, "admin")}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {updatingUserId === user.id ? "Saving..." : "Save facility type"}
                    </button>
                    <button
                      type="button"
                      disabled={updatingUserId === user.id}
                      onClick={() => void updateRole(user, "user")}
                      className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Revoke super admin
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={updatingUserId === user.id}
                    onClick={() => void updateRole(user, "admin")}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {updatingUserId === user.id
                      ? "Saving..."
                      : "Grant super admin"}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-8 text-sm text-slate-600">No registered users yet.</p>
      )}
      {!isLoading && (
        <div className="border-t border-slate-200 px-5 py-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Facility access</h2>
              <p className="mt-1 text-sm text-slate-600">
                Assign a registered user a role at a specific facility.
              </p>
            </div>
            <label className="block min-w-56 space-y-1 text-xs font-medium text-slate-700">
              Facility
              <select
                value={selectedFacilityId}
                onChange={(event) => setSelectedFacilityId(event.target.value)}
                disabled={!facilities.length}
                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm"
              >
                {facilities.map((facility) => (
                  <option key={facility.organizationId} value={facility.organizationId}>
                    {facility.name} ({facility.organizationType})
                  </option>
                ))}
              </select>
            </label>
          </div>
          {!facilities.length ? (
            <p className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
              Create or approve a facility before assigning facility roles.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200">
              {users.map((user) => {
                const membership = user.memberships.find(
                  (item) => item.organizationId === selectedFacilityId,
                );
                const selectedRole =
                  selectedFacilityRoles[`${selectedFacilityId}:${user.id}`] ??
                  membership?.role ??
                  "";
                const isOwner = membership?.role === "owner";

                return (
                  <li
                    key={`facility-${user.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{user.name}</p>
                      <p className="truncate text-xs text-slate-600">{user.email}</p>
                    </div>
                    {isOwner ? (
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        Facility owner
                      </span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="sr-only" htmlFor={`facility-role-${user.id}`}>
                          Facility role for {user.email}
                        </label>
                        <select
                          id={`facility-role-${user.id}`}
                          value={selectedRole}
                          onChange={(event) =>
                            setSelectedFacilityRoles((current) => ({
                              ...current,
                              [`${selectedFacilityId}:${user.id}`]: event.target.value,
                            }))
                          }
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-700"
                        >
                          <option value="">No facility role</option>
                          <option value="admin">Facility Admin</option>
                          <option value="receptionist">Receptionist</option>
                          <option value="doctor">Doctor</option>
                          <option value="nurse">Nurse</option>
                          <option value="patient">Patient</option>
                        </select>
                        <button
                          type="button"
                          disabled={updatingUserId === user.id || !selectedRole}
                          onClick={() => void assignFacilityRole(user)}
                          className="rounded-lg border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {updatingUserId === user.id
                            ? "Saving..."
                            : membership
                              ? "Update role"
                              : "Assign role"}
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
