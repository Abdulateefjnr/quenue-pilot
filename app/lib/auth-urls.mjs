function normalizeOrigin(value, variableName, production, allowLocalHttp) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${variableName} must be a valid absolute URL.`);
  }

  if (
    (url.protocol !== "http:" && url.protocol !== "https:") ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error(`${variableName} must contain only an HTTP(S) origin.`);
  }

  const isLoopback =
    url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname === "[::1]";
  if (
    production &&
    url.protocol !== "https:" &&
    !(isLoopback && allowLocalHttp)
  ) {
    throw new Error(`${variableName} must use HTTPS in production.`);
  }

  return url.origin;
}

export function resolveAuthUrls(env = process.env) {
  const appUrlSource = env.NEXT_PUBLIC_APP_URL?.trim()
    ? "NEXT_PUBLIC_APP_URL"
    : env.RENDER_EXTERNAL_URL?.trim()
      ? "RENDER_EXTERNAL_URL"
      : "BETTER_AUTH_URL";
  const configuredAppUrl = env[appUrlSource]?.trim();
  const configuredAuthUrl =
    env.BETTER_AUTH_URL?.trim() || configuredAppUrl;

  if (!configuredAppUrl || !configuredAuthUrl) {
    throw new Error(
      "Set NEXT_PUBLIC_APP_URL or RENDER_EXTERNAL_URL, and optionally BETTER_AUTH_URL.",
    );
  }

  const requireHttps = env.NODE_ENV === "production";
  const allowLocalHttp = !env.RENDER_EXTERNAL_URL?.trim();

  return {
    appUrl: normalizeOrigin(
      configuredAppUrl,
      appUrlSource,
      requireHttps,
      allowLocalHttp,
    ),
    authUrl: normalizeOrigin(
      configuredAuthUrl,
      env.BETTER_AUTH_URL ? "BETTER_AUTH_URL" : "RENDER_EXTERNAL_URL",
      requireHttps,
      allowLocalHttp,
    ),
  };
}
