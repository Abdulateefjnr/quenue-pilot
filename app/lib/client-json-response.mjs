/**
 * @template T
 * @param {Response} response
 * @param {string} failureMessage
 * @returns {Promise<T>}
 */
export async function readJsonResponse(response, failureMessage) {
  let payload;
  const contentType = response.headers.get("content-type")?.toLowerCase();

  if (contentType?.includes("json")) {
    try {
      payload = await response.json();
    } catch {
      if (response.ok) {
        throw new Error("The server returned an invalid JSON response.");
      }
    }
  }

  if (!response.ok) {
    const serverError =
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : "";
    throw new Error(serverError || `${failureMessage} (HTTP ${response.status}).`);
  }

  if (typeof payload !== "object" || payload === null) {
    throw new Error("The server returned an invalid JSON response.");
  }

  return /** @type {T} */ (payload);
}
