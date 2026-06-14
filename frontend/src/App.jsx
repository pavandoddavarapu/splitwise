import { useState, useEffect } from "react";
import "./App.css";

/**
 * Hello-world shell for Step 1.
 *
 * Proves the full pipeline:
 *   Django (Render) → whitenoise → React index.html → this component
 *
 * Also hits the health-check endpoint to confirm Django is reachable
 * from the same origin (no CORS, no separate deployment).
 *
 * This component will be replaced with real routing and UI from Step 2 onward.
 */
function App() {
  const [apiStatus, setApiStatus] = useState("checking…");

  useEffect(() => {
    fetch("/api/health/")
      .then((res) => res.json())
      .then((data) => setApiStatus(data.status ?? "ok"))
      .catch(() => setApiStatus("unreachable — start Django or check deploy"));
  }, []);

  return (
    <div className="shell">
      <div className="card">
        <h1>🏠 Spreetail</h1>
        <p className="subtitle">Shared Expenses — scaffold OK</p>
        <div className="status-row">
          <span className="label">Django API</span>
          <span className={`badge ${apiStatus === "ok" ? "ok" : "warn"}`}>
            {apiStatus}
          </span>
        </div>
        <p className="note">
          Step 1 complete. Awaiting confirmation to proceed to Step 2 (Auth).
        </p>
      </div>
    </div>
  );
}

export default App;
