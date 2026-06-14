/**
 * AuthPage — combined Login / Register page with tab switching.
 *
 * A single page handles both flows. The active tab drives which fields are
 * shown and which API call is made. This avoids separate /login and /register
 * routes and lets users switch without losing what they've typed in shared fields.
 *
 * Error handling:
 *   DRF returns field-level errors as { field: [messages] } and non-field errors
 *   as { non_field_errors: [messages] }. We display whichever is present.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

function parseError(err) {
  if (!err || typeof err !== "object") return "Something went wrong. Try again.";
  // non_field_errors is DRF's key for serializer-level errors (not field-specific)
  if (err.non_field_errors) return err.non_field_errors.join(" ");
  // Collect all field errors into one string for simplicity
  return Object.values(err).flat().join(" ");
}

export default function AuthPage() {
  const [tab, setTab] = useState("login"); // "login" | "register"
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (tab === "login") {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
      navigate("/");
    } catch (err) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  }

  function switchTab(newTab) {
    setTab(newTab);
    setError("");
  }

  return (
    <div className="auth-bg">
      {/* Decorative background orbs */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />

      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <span className="auth-logo-icon">🏠</span>
          <h1 className="auth-logo-name">Spreetail</h1>
          <p className="auth-logo-tagline">Split bills. Zero confusion.</p>
        </div>

        {/* Tab switcher */}
        <div className="auth-tabs" role="tablist">
          <button
            id="tab-login"
            role="tab"
            aria-selected={tab === "login"}
            className={`auth-tab ${tab === "login" ? "auth-tab--active" : ""}`}
            onClick={() => switchTab("login")}
          >
            Sign in
          </button>
          <button
            id="tab-register"
            role="tab"
            aria-selected={tab === "register"}
            className={`auth-tab ${tab === "register" ? "auth-tab--active" : ""}`}
            onClick={() => switchTab("register")}
          >
            Create account
          </button>
        </div>

        {/* Form */}
        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {tab === "register" && (
            <div className="field">
              <label htmlFor="auth-name">Full name</label>
              <input
                id="auth-name"
                type="text"
                autoComplete="name"
                placeholder="Aisha Kapoor"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="field">
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
              autoComplete={tab === "login" ? "current-password" : "new-password"}
              placeholder={tab === "register" ? "At least 8 characters" : "••••••••"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          {error && (
            <div className="auth-error" role="alert">
              <span className="auth-error-icon">⚠</span>
              {error}
            </div>
          )}

          <button
            id="auth-submit"
            type="submit"
            className="btn-primary"
            disabled={loading}
          >
            {loading ? (
              <span className="spinner" aria-label="Loading" />
            ) : tab === "login" ? (
              "Sign in"
            ) : (
              "Create account"
            )}
          </button>
        </form>

        <p className="auth-switch">
          {tab === "login" ? (
            <>
              No account?{" "}
              <button className="link-btn" onClick={() => switchTab("register")}>
                Sign up free
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button className="link-btn" onClick={() => switchTab("login")}>
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
