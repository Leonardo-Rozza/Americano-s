"use client";

type AuthRefreshResponse =
  | { success: true; data: { refreshed: boolean } }
  | { success: false; error: string };

function resolvePathname(input: RequestInfo | URL): string | null {
  try {
    if (typeof input === "string") {
      return new URL(input, window.location.origin).pathname;
    }
    if (input instanceof URL) {
      return input.pathname;
    }
    return new URL(input.url).pathname;
  } catch {
    return null;
  }
}

function isAuthEndpoint(pathname: string | null): boolean {
  return pathname?.startsWith("/api/auth/") ?? false;
}

function buildLoginPath(): string {
  const next = `${window.location.pathname}${window.location.search}`;
  return `/login?next=${encodeURIComponent(next)}`;
}

async function tryRefreshSession(): Promise<boolean> {
  const response = await fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) {
    return false;
  }

  try {
    const payload = (await response.json()) as AuthRefreshResponse;
    return payload.success;
  } catch {
    return false;
  }
}

export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const response = await fetch(input, init);
  if (response.status !== 401) {
    return response;
  }

  const pathname = resolvePathname(input);
  if (isAuthEndpoint(pathname)) {
    return response;
  }

  const refreshed = await tryRefreshSession();
  if (!refreshed) {
    window.location.assign(buildLoginPath());
    return response;
  }

  return fetch(input, init);
}
