/**
 * DashboardPage — shown to authenticated users.
 *
 * Step 2 scope: proves the full auth flow end-to-end by:
 *   1. Displaying the logged-in user's name and email (from AuthContext)
 *   2. Hitting GET /api/health/ with the Authorization header and showing
 *      the result — proves Django receives and accepts the token on a real request
 *   3. Hitting GET /api/auth/me/ to confirm the protected endpoint also works
 *
 * This page is a placeholder shell. Steps 3–6 will add the real group/expense UI.
 */

import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../api/client";

function StatusBadge({ status }) {
  if (status === "checking")
    return <span className="badge badge--checking">checking…</span>;
  if (status === "ok")
    return <span className="badge badge--ok">✓ ok</span>;
  return <span className="badge badge--error">✗ {status}</span>;
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [healthStatus, setHealthStatus] = useState("checking");
  const [meStatus, setMeStatus] = useState("checking");

  useEffect(() => {
    // Hit /api/health/ — the Authorization header is attached automatically
    // by the api client (token from localStorage). Django doesn't require auth
    // for this endpoint, but the browser's request will carry the header.
    api
      .get("/health/")
      .then((d) => setHealthStatus(d?.status ?? "ok"))
      .catch(() => setHealthStatus("unreachable"));

    // Hit /api/auth/me/ — this IS a protected endpoint. A 401 here would mean
    // the token isn't being sent or was rejected.
    api
      .get("/auth/me/")
      .then((d) => setMeStatus(d?.email ? "ok" : "unexpected response"))
      .catch(() => setMeStatus("401 — token rejected"));
  }, []);

  return (
    <div className="dash-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span>🏠</span>
          <span>Spreetail</span>
        </div>
        <nav className="sidebar-nav">
          <a href="#" className="nav-item nav-item--active">Dashboard</a>
          <a href="#" className="nav-item nav-item--disabled">Groups</a>
          <a href="#" className="nav-item nav-item--disabled">Expenses</a>
          <a href="#" className="nav-item nav-item--disabled">Settlements</a>
          <a href="#" className="nav-item nav-item--disabled">Import CSV</a>
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="avatar">{user?.name?.[0]?.toUpperCase() ?? "?"}</div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user?.name}</span>
              <span className="sidebar-user-email">{user?.email}</span>
            </div>
          </div>
          <button id="logout-btn" className="logout-btn" onClick={logout}>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="dash-main">
        <header className="dash-header">
          <div>
            <h1 className="dash-title">Welcome back, {user?.name?.split(" ")[0]} 👋</h1>
            <p className="dash-subtitle">Step 2 — Auth flow verified</p>
          </div>
        </header>

        <div className="cards-grid">
          {/* Auth verification card */}
          <div className="card">
            <div className="card-header">
              <span className="card-icon">🔒</span>
              <h2 className="card-title">Auth pipeline check</h2>
            </div>
            <p className="card-desc">
              These calls confirm the full chain: React → token in localStorage →
              Authorization header → Django DRF TokenAuthentication → response.
            </p>
            <div className="check-list">
              <div className="check-row">
                <span className="check-label">
                  <code>GET /api/health/</code>
                </span>
                <StatusBadge status={healthStatus} />
              </div>
              <div className="check-row">
                <span className="check-label">
                  <code>GET /api/auth/me/</code> <em>(protected)</em>
                </span>
                <StatusBadge status={meStatus} />
              </div>
            </div>
          </div>

          {/* User info card */}
          <div className="card">
            <div className="card-header">
              <span className="card-icon">👤</span>
              <h2 className="card-title">Your account</h2>
            </div>
            <dl className="info-list">
              <div className="info-row">
                <dt>Name</dt>
                <dd>{user?.name || "—"}</dd>
              </div>
              <div className="info-row">
                <dt>Email</dt>
                <dd>{user?.email}</dd>
              </div>
              <div className="info-row">
                <dt>Member since</dt>
                <dd>
                  {user?.created_at
                    ? new Date(user.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "—"}
                </dd>
              </div>
            </dl>
          </div>

          {/* Coming soon card */}
          <div className="card card--muted">
            <div className="card-header">
              <span className="card-icon">📊</span>
              <h2 className="card-title">Groups & expenses</h2>
            </div>
            <p className="card-desc">
              Step 3 will add group management with membership timelines.
              Steps 4–6 add expense creation, balance calculation, and settlements.
            </p>
            <div className="coming-soon">Coming in Step 3 →</div>
          </div>
        </div>
      </main>
    </div>
  );
}
