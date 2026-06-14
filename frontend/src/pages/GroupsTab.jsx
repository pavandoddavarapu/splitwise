import { useState, useEffect } from "react";
import { api } from "../api/client";
import { useAuth } from "../contexts/AuthContext";

export default function GroupsTab() {
  const { user: currentUser } = useAuth();
  
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // UI state
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [users, setUsers] = useState([]);
  const [groupExpenses, setGroupExpenses] = useState([]);
  const [expensesLoading, setExpensesLoading] = useState(false);
  const [expandedExpenseId, setExpandedExpenseId] = useState(null);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showEditMemberModal, setShowEditMemberModal] = useState(null);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);

  // Form states (Group & Members)
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [joinedAt, setJoinedAt] = useState(new Date().toISOString().split("T")[0]);
  const [leftAt, setLeftAt] = useState("");

  // Form states (Expenses)
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [paidBy, setPaidBy] = useState("");
  const [originalAmount, setOriginalAmount] = useState("");
  const [originalCurrency, setOriginalCurrency] = useState("INR");
  const [splitType, setSplitType] = useState("equal");
  const [splitValues, setSplitValues] = useState({}); // { [userId]: value }
  const [notes, setNotes] = useState("");

  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Fetch groups
  const fetchGroups = async () => {
    try {
      setLoading(true);
      const data = await api.get("/groups/");
      setGroups(data || []);
      setError("");
    } catch (err) {
      setError("Failed to load groups. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch all users for dropdown
  const fetchUsers = async () => {
    try {
      const data = await api.get("/auth/users/");
      setUsers(data || []);
    } catch (err) {
      console.error("Failed to load users", err);
    }
  };

  // Fetch expenses for selected group
  const fetchGroupExpenses = async (groupId) => {
    try {
      setExpensesLoading(true);
      const data = await api.get(`/expenses/?group=${groupId}`);
      setGroupExpenses(data || []);
    } catch (err) {
      console.error("Failed to load group expenses", err);
    } finally {
      setExpensesLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
    fetchUsers();
  }, []);

  // Sync selected group details and fetch its expenses
  useEffect(() => {
    if (selectedGroup) {
      const updated = groups.find((g) => g.id === selectedGroup.id);
      if (updated) {
        setSelectedGroup(updated);
      }
      fetchGroupExpenses(selectedGroup.id);
    } else {
      setGroupExpenses([]);
    }
  }, [selectedGroup, groups]);

  // Create Group
  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;

    setSubmitting(true);
    setFormError("");
    try {
      const newGroup = await api.post("/groups/", { name: newGroupName });
      setNewGroupName("");
      setShowCreateModal(false);
      await fetchGroups();
      setSelectedGroup(newGroup);
    } catch (err) {
      setFormError(err?.name?.[0] || "Failed to create group.");
    } finally {
      setSubmitting(false);
    }
  };

  // Add Member
  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!selectedUserId) {
      setFormError("Please select a user.");
      return;
    }

    setSubmitting(true);
    setFormError("");
    try {
      await api.post(`/groups/${selectedGroup.id}/members/`, {
        user_id: parseInt(selectedUserId, 10),
        joined_at: joinedAt,
        left_at: leftAt || null,
      });
      setSelectedUserId("");
      setJoinedAt(new Date().toISOString().split("T")[0]);
      setLeftAt("");
      setShowAddMemberModal(false);
      await fetchGroups();
    } catch (err) {
      if (err?.left_at) {
        setFormError(err.left_at[0]);
      } else if (err?.user_id) {
        setFormError(err.user_id[0]);
      } else if (err?.non_field_errors) {
        setFormError(err.non_field_errors[0]);
      } else {
        setFormError("Failed to add member.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Edit Member dates
  const handleEditMember = async (e) => {
    e.preventDefault();
    if (!showEditMemberModal) return;

    setSubmitting(true);
    setFormError("");
    try {
      await api.patch(
        `/groups/${selectedGroup.id}/members/${showEditMemberModal.id}/`,
        {
          joined_at: joinedAt,
          left_at: leftAt || null,
        }
      );
      setShowEditMemberModal(null);
      setJoinedAt(new Date().toISOString().split("T")[0]);
      setLeftAt("");
      await fetchGroups();
    } catch (err) {
      if (err?.left_at) {
        setFormError(err.left_at[0]);
      } else if (err?.non_field_errors) {
        setFormError(err.non_field_errors[0]);
      } else {
        setFormError("Failed to update membership dates.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Delete/Remove Member
  const handleRemoveMember = async (membershipId) => {
    if (!window.confirm("Are you sure you want to remove this member from the group?")) {
      return;
    }
    try {
      await api.delete(`/groups/${selectedGroup.id}/members/${membershipId}/`);
      await fetchGroups();
    } catch (err) {
      alert("Failed to remove member.");
    }
  };

  // Helper: Get active members on the selected date (client-side date check)
  const getActiveMembersOnDate = (dateStr) => {
    if (!selectedGroup || !dateStr) return [];
    const targetDate = new Date(dateStr);
    targetDate.setHours(0, 0, 0, 0);

    return selectedGroup.memberships.filter((m) => {
      const joined = new Date(m.joined_at);
      joined.setHours(0, 0, 0, 0);
      const left = m.left_at ? new Date(m.left_at) : null;
      if (left) left.setHours(0, 0, 0, 0);

      if (targetDate < joined) return false;
      if (left && targetDate > left) return false;
      return true;
    });
  };

  // Add Expense
  const handleAddExpense = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError("");

    const activeMembers = getActiveMembersOnDate(expenseDate);
    if (activeMembers.length === 0) {
      setFormError("There are no active members in this group on the selected expense date.");
      setSubmitting(false);
      return;
    }

    // Client-side sum validation before sending to API
    const amountVal = parseFloat(originalAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      setFormError("Expense amount must be a positive number.");
      setSubmitting(false);
      return;
    }

    const splitsPayload = [];
    if (splitType !== "equal") {
      let sum = 0;
      for (const m of activeMembers) {
        const val = parseFloat(splitValues[m.user.id] || 0);
        if (isNaN(val) || val <= 0) {
          setFormError(`Please enter a positive split value for ${m.user.name}.`);
          setSubmitting(false);
          return;
        }
        sum += val;
        splitsPayload.push({ user_id: m.user.id, value: val });
      }

      if (splitType === "percentage" && Math.abs(sum - 100) > 0.01) {
        setFormError(`The sum of percentages must equal 100% (currently ${sum.toFixed(2)}%).`);
        setSubmitting(false);
        return;
      }
      if (splitType === "exact" && Math.abs(sum - amountVal) > 0.01) {
        const symbol = originalCurrency === "USD" ? "$" : "₹";
        setFormError(`The sum of exact split values (${symbol}${sum.toFixed(2)}) must equal the total amount (${symbol}${amountVal.toFixed(2)}).`);
        setSubmitting(false);
        return;
      }
    }

    try {
      await api.post("/expenses/", {
        group: selectedGroup.id,
        paid_by: parseInt(paidBy, 10),
        description,
        expense_date: expenseDate,
        original_amount: amountVal,
        original_currency: originalCurrency,
        split_type: splitType,
        notes,
        splits: splitsPayload,
      });

      // Reset form
      setDescription("");
      setExpenseDate(new Date().toISOString().split("T")[0]);
      setOriginalAmount("");
      setOriginalCurrency("INR");
      setSplitType("equal");
      setSplitValues({});
      setNotes("");
      setShowAddExpenseModal(false);

      // Refresh list
      await fetchGroupExpenses(selectedGroup.id);
    } catch (err) {
      if (err?.splits) {
        setFormError(err.splits[0]);
      } else if (err?.expense_date) {
        setFormError(err.expense_date[0]);
      } else if (err?.non_field_errors) {
        setFormError(err.non_field_errors[0]);
      } else {
        setFormError("Failed to record expense. Verify all fields.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Helper: calculate live split sum in modal
  const getLiveSplitSum = () => {
    const activeMembers = getActiveMembersOnDate(expenseDate);
    return activeMembers.reduce((acc, m) => acc + parseFloat(splitValues[m.user.id] || 0), 0);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Present";
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getAvailableUsers = () => {
    if (!selectedGroup) return users;
    const memberIds = selectedGroup.memberships.map((m) => m.user.id);
    return users.filter((u) => !memberIds.includes(u.id));
  };

  if (loading && groups.length === 0) {
    return (
      <div className="check-list" style={{ justifyContent: "center", minHeight: "200px" }}>
        <div className="loading-spinner" style={{ margin: "auto" }} />
      </div>
    );
  }

  // --- DETAIL VIEW ---
  if (selectedGroup) {
    const activeMembersForExpense = getActiveMembersOnDate(expenseDate);

    return (
      <div>
        <div className="action-bar">
          <button className="btn-secondary" onClick={() => setSelectedGroup(null)}>
            ← Back to Groups
          </button>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button
              className="btn-secondary"
              onClick={() => {
                setFormError("");
                setSelectedUserId("");
                setJoinedAt(new Date().toISOString().split("T")[0]);
                setLeftAt("");
                setShowAddMemberModal(true);
              }}
            >
              + Add Member
            </button>
            <button
              className="btn-primary"
              style={{ width: "auto" }}
              onClick={() => {
                setFormError("");
                setDescription("");
                setExpenseDate(new Date().toISOString().split("T")[0]);
                setPaidBy(currentUser?.id || "");
                setOriginalAmount("");
                setOriginalCurrency("INR");
                setSplitType("equal");
                setSplitValues({});
                setNotes("");
                setShowAddExpenseModal(true);
              }}
            >
              + Add Expense
            </button>
          </div>
        </div>

        {/* Group Meta Card */}
        <div className="card" style={{ marginBottom: "2rem" }}>
          <div className="card-header">
            <span className="card-icon">👥</span>
            <h2 className="card-title">{selectedGroup.name}</h2>
          </div>
          <p className="card-desc">
            Members are only split into expenses if the expense date falls within their active membership window.
          </p>

          <h3 style={{ fontSize: "1.1rem", fontWeight: "600", marginTop: "1.5rem" }}>
            Group Members ({selectedGroup.memberships.length})
          </h3>

          {selectedGroup.memberships.length === 0 ? (
            <p style={{ color: "var(--text-3)", marginTop: "1rem", fontSize: "0.9rem" }}>
              No members in this group yet. Click "Add Member" to add one.
            </p>
          ) : (
            <div className="members-list">
              {selectedGroup.memberships.map((membership) => {
                const isActive =
                  !membership.left_at ||
                  new Date(membership.left_at) >= new Date();

                return (
                  <div className="member-item" key={membership.id}>
                    <div className="member-details">
                      <span className="member-name">
                        {membership.user.name}{" "}
                        <span
                          className={`badge ${isActive ? "badge--ok" : "badge--checking"}`}
                          style={{ marginLeft: "0.5rem" }}
                        >
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </span>
                      <span className="member-dates">
                        Joined: {formatDate(membership.joined_at)} • Left:{" "}
                        {formatDate(membership.left_at)}
                      </span>
                    </div>

                    <div className="member-actions">
                      <button
                        className="btn-icon"
                        title="Edit membership dates"
                        onClick={() => {
                          setFormError("");
                          setJoinedAt(membership.joined_at);
                          setLeftAt(membership.left_at || "");
                          setShowEditMemberModal(membership);
                        }}
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-icon btn-icon--danger"
                        title="Remove member"
                        onClick={() => handleRemoveMember(membership.id)}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Expenses List Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-icon">💸</span>
            <h2 className="card-title">Expenses in this Group</h2>
          </div>
          <p className="card-desc">
            Click an expense to drill down into the detailed split shares.
          </p>

          {expensesLoading ? (
            <div className="check-list" style={{ justifyContent: "center", padding: "2rem" }}>
              <div className="loading-spinner" style={{ margin: "auto" }} />
            </div>
          ) : groupExpenses.length === 0 ? (
            <p style={{ color: "var(--text-3)", textAlign: "center", padding: "2rem 0", fontSize: "0.9rem" }}>
              No expenses recorded in this group. Click "Add Expense" to record one!
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1rem" }}>
              {groupExpenses.map((expense) => {
                const isExpanded = expandedExpenseId === expense.id;
                const isUSD = expense.original_currency === "USD";
                const payerName = expense.shares.find(s => s.user.id === expense.paid_by)?.user?.name || "User";

                return (
                  <div
                    key={expense.id}
                    style={{
                      background: "rgba(0, 0, 0, 0.2)",
                      border: "1px solid var(--border)",
                      borderRadius: "10px",
                      padding: "1rem 1.25rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        cursor: "pointer",
                      }}
                      onClick={() => setExpandedExpenseId(isExpanded ? null : expense.id)}
                    >
                      <div>
                        <span style={{ fontWeight: "600", fontSize: "0.95rem", display: "block" }}>
                          {expense.description}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>
                          Paid by {payerName} on {formatDate(expense.expense_date)}
                        </span>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontWeight: "700", color: "var(--text-1)" }}>
                          ₹{parseFloat(expense.amount_inr).toFixed(2)}
                        </span>
                        {isUSD && (
                          <span style={{ fontSize: "0.7rem", color: "var(--text-3)", display: "block" }}>
                            Original: ${parseFloat(expense.original_amount).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div
                        style={{
                          marginTop: "1rem",
                          paddingTop: "0.75rem",
                          borderTop: "1px solid var(--border)",
                          animation: "fadeIn 0.15s ease-out",
                        }}
                      >
                        <p style={{ fontSize: "0.75rem", color: "var(--text-3)", marginBottom: "0.5rem" }}>
                          Split Method: <span style={{ textTransform: "capitalize" }}>{expense.split_type}</span>
                        </p>
                        {expense.notes && (
                          <p style={{ fontSize: "0.8rem", color: "var(--text-2)", marginBottom: "0.75rem", background: "rgba(0,0,0,0.15)", padding: "0.5rem", borderRadius: "4px" }}>
                            <strong>Notes:</strong> {expense.notes}
                          </p>
                        )}
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                          {expense.shares.map((share) => (
                            <div
                              key={share.id}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: "0.85rem",
                                background: "rgba(255,255,255,0.01)",
                                padding: "0.35rem 0.5rem",
                                borderRadius: "4px",
                              }}
                            >
                              <span>{share.user.name}</span>
                              <div style={{ display: "flex", gap: "0.75rem" }}>
                                <span style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>
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

        {/* Add Member Modal */}
        {showAddMemberModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3 className="modal-title">Add Group Member</h3>
                <button className="modal-close" onClick={() => setShowAddMemberModal(false)}>&times;</button>
              </div>

              <form onSubmit={handleAddMember} className="auth-form">
                <div className="field">
                  <label htmlFor="user-select">Select User</label>
                  <select
                    id="user-select"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    required
                  >
                    <option value="">-- Select a user --</option>
                    {getAvailableUsers().map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="join-date">Joined Date</label>
                  <input
                    id="join-date"
                    type="date"
                    value={joinedAt}
                    onChange={(e) => setJoinedAt(e.target.value)}
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="leave-date">Leave Date (Optional)</label>
                  <input
                    id="leave-date"
                    type="date"
                    value={leftAt}
                    onChange={(e) => setLeftAt(e.target.value)}
                  />
                </div>

                {formError && (
                  <div className="auth-error">
                    <span className="auth-error-icon">⚠️</span>
                    <span>{formError}</span>
                  </div>
                )}

                <div className="modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => setShowAddMemberModal(false)} disabled={submitting}>Cancel</button>
                  <button type="submit" className="btn-primary" style={{ width: "auto" }} disabled={submitting}>
                    {submitting ? "Adding..." : "Add Member"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Member Dates Modal */}
        {showEditMemberModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3 className="modal-title">Edit Membership Dates</h3>
                <button className="modal-close" onClick={() => setShowEditMemberModal(null)}>&times;</button>
              </div>

              <form onSubmit={handleEditMember} className="auth-form">
                <div className="field">
                  <label>User</label>
                  <input type="text" value={showEditMemberModal.user.name} disabled style={{ opacity: 0.7 }} />
                </div>

                <div className="field">
                  <label htmlFor="edit-join-date">Joined Date</label>
                  <input
                    id="edit-join-date"
                    type="date"
                    value={joinedAt}
                    onChange={(e) => setJoinedAt(e.target.value)}
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="edit-leave-date">Leave Date (Optional)</label>
                  <input
                    id="edit-leave-date"
                    type="date"
                    value={leftAt}
                    onChange={(e) => setLeftAt(e.target.value)}
                  />
                </div>

                {formError && (
                  <div className="auth-error">
                    <span className="auth-error-icon">⚠️</span>
                    <span>{formError}</span>
                  </div>
                )}

                <div className="modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => setShowEditMemberModal(null)} disabled={submitting}>Cancel</button>
                  <button type="submit" className="btn-primary" style={{ width: "auto" }} disabled={submitting}>
                    {submitting ? "Saving..." : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Expense Modal */}
        {showAddExpenseModal && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: "520px" }}>
              <div className="modal-header">
                <h3 className="modal-title">Create Manual Expense</h3>
                <button className="modal-close" onClick={() => setShowAddExpenseModal(false)}>&times;</button>
              </div>

              <form onSubmit={handleAddExpense} className="auth-form">
                <div className="field">
                  <label htmlFor="exp-desc">Description</label>
                  <input
                    id="exp-desc"
                    type="text"
                    placeholder="e.g. Electric bill, Uber"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="exp-date">Expense Date</label>
                  <input
                    id="exp-date"
                    type="date"
                    value={expenseDate}
                    onChange={(e) => {
                      setExpenseDate(e.target.value);
                      // Clear split values on date change since active members change
                      setSplitValues({});
                    }}
                    required
                  />
                  <span style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>
                    Only members active on this date will participate in the split.
                  </span>
                </div>

                <div style={{ display: "flex", gap: "1rem" }}>
                  <div className="field" style={{ flex: 1 }}>
                    <label htmlFor="exp-payer">Paid By</label>
                    <select
                      id="exp-payer"
                      value={paidBy}
                      onChange={(e) => setPaidBy(e.target.value)}
                      required
                    >
                      <option value="">-- Select Payer --</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field" style={{ width: "130px" }}>
                    <label htmlFor="exp-currency">Currency</label>
                    <select
                      id="exp-currency"
                      value={originalCurrency}
                      onChange={(e) => setOriginalCurrency(e.target.value)}
                      required
                    >
                      <option value="INR">INR (₹)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "1rem" }}>
                  <div className="field" style={{ flex: 1 }}>
                    <label htmlFor="exp-amount">Amount</label>
                    <input
                      id="exp-amount"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={originalAmount}
                      onChange={(e) => setOriginalAmount(e.target.value)}
                      required
                    />
                  </div>

                  <div className="field" style={{ flex: 1 }}>
                    <label htmlFor="exp-split">Split Type</label>
                    <select
                      id="exp-split"
                      value={splitType}
                      onChange={(e) => {
                        setSplitType(e.target.value);
                        setSplitValues({});
                      }}
                      required
                    >
                      <option value="equal">Equal Split</option>
                      <option value="percentage">Percentage</option>
                      <option value="exact">Exact amounts</option>
                      <option value="share">Share / ratio</option>
                    </select>
                  </div>
                </div>

                {originalCurrency === "USD" && originalAmount && (
                  <div style={{ fontSize: "0.8rem", color: "#a78bfa", padding: "0.25rem 0.5rem", background: "rgba(124,58,237,0.1)", borderRadius: "6px" }}>
                    ℹ️ USD converts at the fixed rate of ₹83.50. Calculated amount: <strong>₹{(parseFloat(originalAmount) * 83.5).toFixed(2)} INR</strong>.
                  </div>
                )}

                {/* Split Configuration Panel */}
                <div style={{ marginTop: "1rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
                  <h4 style={{ fontSize: "0.9rem", fontWeight: "600", marginBottom: "0.75rem" }}>
                    Split Weights (Active members on date: {activeMembersForExpense.length})
                  </h4>

                  {activeMembersForExpense.length === 0 ? (
                    <p style={{ color: "var(--error)", fontSize: "0.85rem" }}>
                      ⚠️ No group members are active on this date! Please change the date.
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                      {activeMembersForExpense.map((m) => {
                        const val = splitValues[m.user.id] || "";
                        
                        return (
                          <div
                            key={m.user.id}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              fontSize: "0.875rem",
                            }}
                          >
                            <span>{m.user.name}</span>
                            
                            {splitType === "equal" ? (
                              <span style={{ color: "var(--text-3)", fontSize: "0.8rem" }}>
                                {originalAmount ? `₹${((parseFloat(originalAmount) * (originalCurrency === "USD" ? 83.50 : 1.0)) / activeMembersForExpense.length).toFixed(2)}` : "—"}
                              </span>
                            ) : (
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <input
                                  type="number"
                                  step="any"
                                  style={{ width: "90px", padding: "0.3rem 0.5rem", background: "rgba(0,0,0,0.3)", border: "1px solid var(--border)", borderRadius: "6px", color: "var(--text-1)" }}
                                  placeholder={
                                    splitType === "percentage"
                                      ? "0 %"
                                      : splitType === "share"
                                      ? "1 share"
                                      : "₹ 0.00"
                                  }
                                  value={val}
                                  onChange={(e) => {
                                    setSplitValues({
                                      ...splitValues,
                                      [m.user.id]: e.target.value,
                                    });
                                  }}
                                  required
                                />
                                <span style={{ fontSize: "0.8rem", color: "var(--text-3)" }}>
                                  {splitType === "percentage" ? "%" : splitType === "share" ? "shares" : originalCurrency}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {splitType !== "equal" && activeMembersForExpense.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.82rem",
                        color: "var(--text-2)",
                        marginTop: "1rem",
                        background: "rgba(0,0,0,0.15)",
                        padding: "0.5rem 0.75rem",
                        borderRadius: "6px",
                      }}
                    >
                      <span>
                        Total Entered: <strong>{getLiveSplitSum().toFixed(2)}</strong>
                        {splitType === "percentage" ? "%" : ` ${originalCurrency}`}
                      </span>
                      <span>
                        Target:{" "}
                        <strong>
                          {splitType === "percentage"
                            ? "100.00%"
                            : `${originalCurrency === "USD" ? "$" : "₹"}${parseFloat(originalAmount || 0).toFixed(2)}`}
                        </strong>
                      </span>
                    </div>
                  )}
                </div>

                <div className="field" style={{ marginTop: "0.5rem" }}>
                  <label htmlFor="exp-notes">Notes</label>
                  <textarea
                    id="exp-notes"
                    style={{ background: "rgba(0,0,0,0.4)", border: "1px solid var(--border)", borderRadius: "10px", padding: "0.7rem 0.9rem", color: "var(--text-1)", resize: "none", height: "60px", fontFamily: "inherit" }}
                    placeholder="Optional notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                {formError && (
                  <div className="auth-error">
                    <span className="auth-error-icon">⚠️</span>
                    <span>{formError}</span>
                  </div>
                )}

                <div className="modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => setShowAddExpenseModal(false)} disabled={submitting}>Cancel</button>
                  <button type="submit" className="btn-primary" style={{ width: "auto" }} disabled={submitting}>
                    {submitting ? "Saving..." : "Record Expense"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --- LIST VIEW ---
  return (
    <div>
      <div className="action-bar">
        <h2 style={{ fontSize: "1.25rem", fontWeight: "700" }}>Groups</h2>
        <button
          className="btn-primary"
          style={{ width: "auto" }}
          onClick={() => {
            setFormError("");
            setNewGroupName("");
            setShowCreateModal(true);
          }}
        >
          + Create Group
        </button>
      </div>

      {error && (
        <div className="auth-error" style={{ marginBottom: "1.5rem" }}>
          <span className="auth-error-icon">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {groups.length === 0 ? (
        <div
          className="card"
          style={{
            textAlign: "center",
            padding: "3rem",
            color: "var(--text-3)",
          }}
        >
          <span style={{ fontSize: "2.5rem", display: "block", marginBottom: "1rem" }}>
            🏠
          </span>
          <p>No expense groups created yet.</p>
          <button
            className="btn-primary"
            style={{ width: "auto", marginTop: "1rem" }}
            onClick={() => setShowCreateModal(true)}
          >
            Create your first group
          </button>
        </div>
      ) : (
        <div className="groups-grid">
          {groups.map((g) => (
            <div
              className="card group-card"
              key={g.id}
              onClick={() => setSelectedGroup(g)}
            >
              <div className="group-card-header">
                <h3 className="card-title" style={{ fontSize: "1.1rem" }}>
                  {g.name}
                </h3>
                <span className="member-count-badge">
                  {g.memberships.length}{" "}
                  {g.memberships.length === 1 ? "member" : "members"}
                </span>
              </div>
              <p
                style={{
                  fontSize: "0.8rem",
                  color: "var(--text-3)",
                  marginTop: "0.75rem",
                }}
              >
                Created on {new Date(g.created_at).toLocaleDateString("en-IN")}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 className="modal-title">Create New Group</h3>
              <button
                className="modal-close"
                onClick={() => setShowCreateModal(false)}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateGroup} className="auth-form">
              <div className="field">
                <label htmlFor="group-name-input">Group Name</label>
                <input
                  id="group-name-input"
                  type="text"
                  placeholder="e.g. Ski Trip 2026, Room 304"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              {formError && (
                <div className="auth-error">
                  <span className="auth-error-icon">⚠️</span>
                  <span>{formError}</span>
                </div>
              )}

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  style={{ width: "auto" }}
                  disabled={submitting}
                >
                  {submitting ? "Creating..." : "Create Group"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
