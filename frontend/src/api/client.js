/**
 * Thin API client for Spreetail.
 *
 * Reads the auth token from localStorage and attaches it as
 * `Authorization: Token <key>` on every request. This matches
 * DRF's TokenAuthentication header format exactly.
 *
 * Error handling:
 *   - Non-2xx responses throw the parsed JSON body (so callers
 *     can read `error.non_field_errors` etc. from DRF).
 *   - 204 No Content returns null (logout endpoint).
 *   - Network errors propagate as-is.
 */

const BASE = "/api";

function getToken() {
  return localStorage.getItem("token");
}

async function request(method, path, body) {
  const headers = { "Content-Type": "application/json" };

  const token = getToken();
  if (token) {
    headers["Authorization"] = `Token ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;

  const data = await res.json();
  if (!res.ok) {
    // Throw the DRF error body so callers can display field-level errors.
    throw data;
  }
  return data;
}

export const api = {
  get: (path) => request("GET", path),
  post: (path, body) => request("POST", path, body),
  put: (path, body) => request("PUT", path, body),
  patch: (path, body) => request("PATCH", path, body),
  delete: (path) => request("DELETE", path),
};
