/**
 * DashboardPage — shown to authenticated users.
 *
 * Proves the full auth flow end-to-end and provides tabbed navigation.
 * Step 4: Adds Expenses listing tab.
 */

import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../api/client";
import GroupsTab from "./GroupsTab";
import ExpensesTab from "./ExpensesTab";

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
  const [activeTab, setActiveTab] = useState("dashboard");

  useEffect(() => {
    // Hit /api/health/ — the Authorization header is attached automatically
    // by the api client.
    api
      .get("/health/")
      .then((d) => setHealthStatus(d?.status ?? "ok"))
      .catch(() => setHealthStatus("unreachable"));

    // Hit /api/auth/me/ — this IS a protected endpoint.
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
          <a
            href="#"
            className={`nav-item ${activeTab === "dashboard" ? "nav-item--active" : ""}`}
            onClick={(e) => {
              e.preventDefault();
              setActiveTab("dashboard");
            }}
          >
            Dashboard
          </a>
          <a
            href="#"
            className={`nav-item ${activeTab === "groups" ? "nav-item--active" : ""}`}
            onClick={(e) => {
              e.preventDefault();
              setActiveTab("groups");
            }}
          >
            Groups
          </a>
          <a
            href="#"
            className={`nav-item ${activeTab === "expenses" ? "nav-item--active" : ""}`}
            onClick={(e) => {
              e.preventDefault();
              setActiveTab("expenses");
            }}
          >
            Expenses
          </a>
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
        {activeTab === "groups" && (
          <>
            <header className="dash-header">
              <div>
                <h1 className="dash-title">Groups & Memberships 🏠</h1>
                <p className="dash-subtitle">Manage flatmate groups and active membership timelines</p>
              </div>
            </header>
            <GroupsTab />
          </>
        )}

        {activeTab === "expenses" && (
          <>
            <header className="dash-header">
              <div>
                <h1 className="dash-title">Expenses 💸</h1>
                <p className="dash-subtitle">List and drill-down into shared expense breakdowns</p>
              </div>
            </header>
            <ExpensesTab />
          </>
        )}

        {activeTab === "dashboard" && (
          <>
            <header className="dash-header">
              <div>
                <h1 className="dash-title">Welcome back, {user?.name?.split(" ")[0]} 👋</h1>
                <p className="dash-subtitle">Step 4 — Manual expense splits active</p>
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

              {/* Quick actions card */}
              <div className="card">
                <div className="card-header">
                  <span className="card-icon">⚡</span>
                  <h2 className="card-title">Quick Actions</h2>
                </div>
                <p className="card-desc">
                  Jump directly to different parts of the application or configure settings.
                </p>
                <div style={{ display: "flex", gap: "0.75rem" }}>
                  <button
                    className="btn-primary"
                    style={{ flex: 1 }}
                    onClick={() => setActiveTab("groups")}
                  >
                    Manage Groups
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ flex: 1 }}
                    onClick={() => setActiveTab("expenses")}
                  >
                    View Expenses
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
