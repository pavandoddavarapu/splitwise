import { useState, useEffect } from "react";
import { api } from "../api/client";

export default function ExpensesTab() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedExpenseId, setExpandedExpenseId] = useState(null);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const data = await api.get("/expenses/");
      setExpenses(data || []);
      setError("");
    } catch (err) {
      setError("Failed to load expenses.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const toggleExpand = (id) => {
    setExpandedExpenseId(expandedExpenseId === id ? null : id);
  };

  if (loading && expenses.length === 0) {
    return (
      <div className="check-list" style={{ justifyContent: "center", minHeight: "200px" }}>
        <div className="loading-spinner" style={{ margin: "auto" }} />
      </div>
    );
  }

  return (
    <div>
      <div className="action-bar">
        <h2 style={{ fontSize: "1.25rem", fontWeight: "700" }}>All Expenses</h2>
        <button className="btn-secondary" onClick={fetchExpenses}>
          🔄 Refresh
        </button>
      </div>

      {error && (
        <div className="auth-error" style={{ marginBottom: "1.5rem" }}>
          <span className="auth-error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {expenses.length === 0 ? (
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: "3rem",
            color: "var(--text-3)",
          }}
        >
          <span style={{ fontSize: "2.5rem", display: "block", marginBottom: "1rem" }}>
            💸
          </span>
          <p>No expenses recorded yet. Go to the "Groups" tab, select a group, and add an expense.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {expenses.map((expense) => {
            const isExpanded = expandedExpenseId === expense.id;
            const isUSD = expense.original_currency === "USD";

            return (
              <div
                className="card"
                key={expense.id}
                style={{
                  borderLeft: isExpanded ? "4px solid var(--primary)" : "1px solid var(--border)",
                  padding: "1.25rem 1.5rem",
                  transition: "border-color 0.2s",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    cursor: "pointer",
                  }}
                  onClick={() => toggleExpand(expense.id)}
                >
                  <div>
                    <h3 className="card-title" style={{ fontSize: "1.05rem" }}>
                      {expense.description}
                    </h3>
                    <p style={{ fontSize: "0.8rem", color: "var(--text-2)", marginTop: "0.25rem" }}>
                      Paid by <strong>{expense.shares.find(s => s.user.id === expense.paid_by)?.user?.name || "User"}</strong> on {formatDate(expense.expense_date)}
                    </p>
                  </div>

                  <div style={{ textAlignment: "right", display: "flex", flexDirection: "column", alignItems: "end" }}>
                    <span style={{ fontSize: "1.1rem", fontWeight: "700", color: "var(--text-1)" }}>
                      ₹{parseFloat(expense.amount_inr).toFixed(2)}
                    </span>
                    {isUSD && (
                      <span style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>
                        Original: ${parseFloat(expense.original_amount).toFixed(2)} (Rate: 83.50)
                      </span>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div
                    style={{
                      marginTop: "1.25rem",
                      paddingTop: "1rem",
                      borderTop: "1px solid var(--border)",
                      animation: "fadeIn 0.2s ease-out",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.82rem",
                        color: "var(--text-3)",
                        marginBottom: "0.75rem",
                      }}
                    >
                      <span>Split Type: <strong style={{ textTransform: "capitalize" }}>{expense.split_type}</strong></span>
                      <span>Created: {new Date(expense.created_at).toLocaleString("en-IN")}</span>
                    </div>

                    {expense.notes && (
                      <div
                        style={{
                          background: "rgba(0,0,0,0.2)",
                          padding: "0.75rem 1rem",
                          borderRadius: "8px",
                          fontSize: "0.85rem",
                          color: "var(--text-2)",
                          marginBottom: "1rem",
                          borderLeft: "2px solid var(--border)",
                        }}
                      >
                        <strong>Notes:</strong> {expense.notes}
                      </div>
                    )}

                    <h4 style={{ fontSize: "0.9rem", fontWeight: "600", marginBottom: "0.6rem" }}>
                      Split Details
                    </h4>
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                      {expense.shares.map((share) => (
                        <div
                          key={share.id}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            background: "rgba(255,255,255,0.02)",
                            padding: "0.5rem 0.75rem",
                            borderRadius: "6px",
                            fontSize: "0.875rem",
                          }}
                        >
                          <span style={{ fontWeight: "500" }}>{share.user.name}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                            <span style={{ fontSize: "0.78rem", color: "var(--text-3)" }}>
                              {share.share_raw}
                            </span>
                            <span style={{ fontWeight: "600", color: "var(--text-2)" }}>
                              ₹{parseFloat(share.share_amount_inr).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
