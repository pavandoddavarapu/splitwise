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

  // Balance & Settlement states
  const [balancesData, setBalancesData] = useState(null);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [selectedDrilldownUser, setSelectedDrilldownUser] = useState(null);
  const [drilldownData, setDrilldownData] = useState(null);
  const [drilldownLoading, setDrilldownLoading] = useState(false);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showEditMemberModal, setShowEditMemberModal] = useState(null);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showSettleModal, setShowSettleModal] = useState(false);

  // Form states (Group & Members)
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [joinedAt, setJoinedAt] = useState(new Date().toISOString().split("T")[0]);
  const [leftAt, setLeftAt] = useState("");

  // Quick Register User form states
  const [isCreatingNewUser, setIsCreatingNewUser] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("Spreetail123!");

  // Form states (Expenses)
  const [description, setDescription] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [paidBy, setPaidBy] = useState("");
  const [originalAmount, setOriginalAmount] = useState("");
  const [originalCurrency, setOriginalCurrency] = useState("INR");
  const [splitType, setSplitType] = useState("equal");
  const [splitValues, setSplitValues] = useState({}); // { [userId]: value }
  const [notes, setNotes] = useState("");

  // Form states (Settlement)
  const [settleSender, setSettleSender] = useState("");
  const [settleRecipient, setSettleRecipient] = useState("");
  const [settleAmount, setSettleAmount] = useState("");
  const [settleDate, setSettleDate] = useState(new Date().toISOString().split("T")[0]);
  const [settleNotes, setSettleNotes] = useState("");

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

  // Fetch group balances (and simplified settlements)
  const fetchGroupBalances = async (groupId) => {
    try {
      setBalancesLoading(true);
      const data = await api.get(`/expenses/groups/${groupId}/balances/`);
      setBalancesData(data || null);
    } catch (err) {
      console.error("Failed to load group balances", err);
    } finally {
      setBalancesLoading(false);
    }
  };

  // Fetch drill-down details for a specific member
  const fetchUserDrilldown = async (userId, groupId) => {
    try {
      setDrilldownLoading(true);
      const data = await api.get(`/expenses/users/${userId}/balance-detail/?group=${groupId}`);
      setDrilldownData(data || null);
    } catch (err) {
      console.error("Failed to load balance drilldown", err);
    } finally {
      setDrilldownLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
    fetchUsers();
  }, []);

  // Sync selected group details, balances, and expenses
  useEffect(() => {
    if (selectedGroup) {
      const updated = groups.find((g) => g.id === selectedGroup.id);
      if (updated) {
        setSelectedGroup(updated);
      }
      fetchGroupExpenses(selectedGroup.id);
      fetchGroupBalances(selectedGroup.id);
    } else {
      setGroupExpenses([]);
      setBalancesData(null);
    }
  }, [selectedGroup, groups]);

  // Trigger drill-down fetch
  useEffect(() => {
    if (selectedDrilldownUser && selectedGroup) {
      fetchUserDrilldown(selectedDrilldownUser.id, selectedGroup.id);
    } else {
      setDrilldownData(null);
    }
  }, [selectedDrilldownUser, selectedGroup]);

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

    setSubmitting(true);
    setFormError("");

    let targetUserId = selectedUserId;

    try {
      if (isCreatingNewUser) {
        if (!newUserName.trim()) {
          setFormError("Please enter a name.");
          setSubmitting(false);
          return;
        }
        if (!newUserEmail.trim()) {
          setFormError("Please enter an email.");
          setSubmitting(false);
          return;
        }
        if (!newUserPassword || newUserPassword.length < 8) {
          setFormError("Password must be at least 8 characters long.");
          setSubmitting(false);
          return;
        }

        // Register the new user
        const regRes = await api.post("/auth/register/", {
          name: newUserName.trim(),
          email: newUserEmail.trim(),
          password: newUserPassword,
        });

        targetUserId = regRes.user.id;
      } else {
        if (!targetUserId) {
          setFormError("Please select a user.");
          setSubmitting(false);
          return;
        }
      }

      await api.post(`/groups/${selectedGroup.id}/members/`, {
        user_id: parseInt(targetUserId, 10),
        joined_at: joinedAt,
        left_at: leftAt || null,
      });

      setSelectedUserId("");
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("Spreetail123!");
      setIsCreatingNewUser(false);
      setJoinedAt(new Date().toISOString().split("T")[0]);
      setLeftAt("");
      setShowAddMemberModal(false);

      // Refresh both lists
      await fetchUsers();
      await fetchGroups();
    } catch (err) {
      if (err?.email) {
        setFormError(`Email error: ${err.email[0]}`);
      } else if (err?.name) {
        setFormError(`Name error: ${err.name[0]}`);
      } else if (err?.password) {
        setFormError(`Password error: ${err.password[0]}`);
      } else if (err?.left_at) {
        setFormError(err.left_at[0]);
      } else if (err?.user_id) {
        setFormError(err.user_id[0]);
      } else if (err?.non_field_errors) {
        setFormError(err.non_field_errors[0]);
      } else if (err?.detail) {
        setFormError(err.detail);
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

  // Helper: Get active members on date
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

  // Helper: Get users not already in the selected group (for Add Member dropdown)
  const getAvailableUsers = () => {
    if (!selectedGroup) return users;
    const existingUserIds = new Set(
      selectedGroup.memberships.map((m) => m.user.id)
    );
    return users.filter((u) => !existingUserIds.has(u.id));
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
        setFormError(`The sum of percentages must equal 100% (currently {sum.toFixed(2)}%).`);
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

      setDescription("");
      setExpenseDate(new Date().toISOString().split("T")[0]);
      setOriginalAmount("");
      setOriginalCurrency("INR");
      setSplitType("equal");
      setSplitValues({});
      setNotes("");
      setShowAddExpenseModal(false);

      // Refresh list & balances
      await fetchGroupExpenses(selectedGroup.id);
      await fetchGroupBalances(selectedGroup.id);
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

  // Settle Up
  const handleRecordSettlement = async (e) => {
    e.preventDefault();
    if (!settleSender || !settleRecipient) {
      setFormError("Please select both sender and recipient.");
      return;
    }
    if (settleSender === settleRecipient) {
      setFormError("Sender and recipient must be different flatmates.");
      return;
    }

    const amt = parseFloat(settleAmount);
    if (isNaN(amt) || amt <= 0) {
      setFormError("Amount must be a positive value.");
      return;
    }

    setSubmitting(true);
    setFormError("");
    try {
      await api.post("/expenses/settlements/", {
        group: selectedGroup.id,
        paid_by: parseInt(settleSender, 10),
        paid_to: parseInt(settleRecipient, 10),
        amount_inr: amt,
        settled_at: new Date(settleDate).toISOString(),
        notes: settleNotes,
      });

      setSettleSender("");
      setSettleRecipient("");
      setSettleAmount("");
      setSettleNotes("");
      setShowSettleModal(false);

      // Reload
      await fetchGroupExpenses(selectedGroup.id);
      await fetchGroupBalances(selectedGroup.id);
    } catch (err) {
      if (err?.paid_by) {
        setFormError(err.paid_by[0]);
      } else if (err?.paid_to) {
        setFormError(err.paid_to[0]);
      } else if (err?.non_field_errors) {
        setFormError(err.non_field_errors[0]);
      } else {
        setFormError("Failed to record payment. Verify inputs.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Helper: trigger settle modal from suggestion
  const handleSettleSuggestion = (fromId, toId, amount) => {
    setFormError("");
    setSettleSender(fromId);
    setSettleRecipient(toId);
    setSettleAmount(parseFloat(amount).toFixed(2));
    setSettleDate(new Date().toISOString().split("T")[0]);
    setSettleNotes("Greedy settlement simplification");
    setShowSettleModal(true);
  };

  const getLiveSplitSum = () => {
    const activeMembers = getActiveMembersOnDate(expenseDate);
    return activeMembers.reduce((acc, m) => acc + parseFloat(splitValues[m.user.id] || 0), 0);
  };

  const formatDateLabel = (dateString) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
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
                setNewUserName("");
                setNewUserEmail("");
                setNewUserPassword("Spreetail123!");
                setIsCreatingNewUser(false);
                setJoinedAt(new Date().toISOString().split("T")[0]);
                setLeftAt("");
                setShowAddMemberModal(true);
              }}
            >
              + Add Member
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                setFormError("");
                setSettleSender("");
                setSettleRecipient("");
                setSettleAmount("");
                setSettleDate(new Date().toISOString().split("T")[0]);
                setSettleNotes("");
                setShowSettleModal(true);
              }}
            >
              🤝 Settle Up
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

        {/* Group Meta & Timeline Card */}
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <div className="card-header">
            <span className="card-icon">👥</span>
            <h2 className="card-title">{selectedGroup.name}</h2>
          </div>
          <p className="card-desc">
            timeline check is active: expenses are only split among members whose membership window covers the expense date.
          </p>

          <h3 style={{ fontSize: "1rem", fontWeight: "600", marginTop: "1rem" }}>
            Timeline Ranges ({selectedGroup.memberships.length} members)
          </h3>
          <div className="members-list" style={{ marginTop: "0.5rem" }}>
            {selectedGroup.memberships.map((m) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.85rem",
                  background: "rgba(255,255,255,0.02)",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "6px",
                }}
              >
                <strong>{m.user.name}</strong>
                <span style={{ color: "var(--text-2)" }}>
                  {formatDateLabel(m.joined_at)} → {m.left_at ? formatDateLabel(m.left_at) : "Present"}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Aisha's Greedy simplified settlements card */}
        {balancesData?.suggested_settlements?.length > 0 && (
          <div className="card" style={{ marginBottom: "1.5rem", border: "1px solid var(--primary-glow)", background: "rgba(124,58,237,0.03)" }}>
            <div className="card-header">
              <span className="card-icon">💡</span>
              <h2 className="card-title" style={{ color: "#c4b5fd" }}>Simplified Settlements (Greedy Clearing)</h2>
            </div>
            <p className="card-desc" style={{ color: "var(--text-2)" }}>
              Aisha's "one number per person" view. Shows the minimum transfers required to clear all outstanding balances.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.5rem" }}>
              {balancesData.suggested_settlements.map((s, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    background: "rgba(0,0,0,0.3)",
                    padding: "0.6rem 1rem",
                    borderRadius: "8px",
                    fontSize: "0.875rem",
                  }}
                >
                  <span>
                    <strong>{s.from_user.name}</strong> owes <strong>{s.to_user.name}</strong>{" "}
                    <strong style={{ color: "var(--text-1)" }}>₹{s.amount_inr.toFixed(2)}</strong>
                  </span>
                  <button
                    className="coming-soon"
                    style={{ border: "none", cursor: "pointer", display: "inline-flex", textDecoration: "none" }}
                    onClick={() => handleSettleSuggestion(s.from_user.id, s.to_user.id, s.amount_inr)}
                  >
                    Settle up →
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Balances Card */}
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <div className="card-header">
            <span className="card-icon">📊</span>
            <h2 className="card-title">Live Balances</h2>
          </div>
          <p className="card-desc">
            Outstanding balance = paid - owed + settled_paid - settled_received. Click a row to see the audit trail.
          </p>

          {balancesLoading ? (
            <div className="check-list" style={{ justifyContent: "center", padding: "1rem" }}>
              <div className="loading-spinner" style={{ margin: "auto" }} />
            </div>
          ) : !balancesData?.balances ? (
            <p>Failed to calculate balances.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem", textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--text-3)" }}>
                    <th style={{ padding: "0.5rem" }}>Flatmate</th>
                    <th style={{ padding: "0.5rem", textAlign: "right" }}>Paid</th>
                    <th style={{ padding: "0.5rem", textAlign: "right" }}>Owed</th>
                    <th style={{ padding: "0.5rem", textAlign: "right" }}>Settled</th>
                    <th style={{ padding: "0.5rem", textAlign: "right" }}>Net Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {balancesData.balances.map((b) => {
                    const isCreditor = b.net_balance > 0.005;
                    const isDebtor = b.net_balance < -0.005;
                    const netSettlements = b.settlements_paid - b.settlements_received;

                    return (
                      <tr
                        key={b.user_id}
                        className="member-item"
                        style={{
                          borderBottom: "1px solid var(--border)",
                          cursor: "pointer",
                          display: "table-row",
                          background: "none",
                        }}
                        onClick={() => {
                          const member = selectedGroup.memberships.find(m => m.user.id === b.user_id)?.user;
                          if (member) setSelectedDrilldownUser({ ...member, net_balance: b.net_balance });
                        }}
                      >
                        <td style={{ padding: "0.75rem 0.5rem" }}>
                          <strong>{b.user_name}</strong>
                          <span style={{ display: "block", fontSize: "0.75rem", color: "var(--text-3)" }}>Click to audit 🔍</span>
                        </td>
                        <td style={{ padding: "0.75rem 0.5rem", textAlign: "right", color: "var(--text-2)" }}>
                          ₹{b.expenses_paid.toFixed(2)}
                        </td>
                        <td style={{ padding: "0.75rem 0.5rem", textAlign: "right", color: "var(--text-2)" }}>
                          ₹{b.shares_owed.toFixed(2)}
                        </td>
                        <td style={{ padding: "0.75rem 0.5rem", textAlign: "right", color: "var(--text-2)" }}>
                          {netSettlements >= 0 ? "+" : ""}₹{netSettlements.toFixed(2)}
                        </td>
                        <td
                          style={{
                            padding: "0.75rem 0.5rem",
                            textAlign: "right",
                            fontWeight: "700",
                            color: isCreditor ? "var(--success)" : isDebtor ? "var(--error)" : "var(--text-3)",
                          }}
                        >
                          {isCreditor ? "+" : ""}
                          {b.net_balance.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Expenses List Card */}
        <div className="card">
          <div className="card-header">
            <span className="card-icon">💸</span>
            <h2 className="card-title">Expenses & Payments Logs</h2>
          </div>

          {expensesLoading ? (
            <div className="check-list" style={{ justifyContent: "center", padding: "1rem" }}>
              <div className="loading-spinner" style={{ margin: "auto" }} />
            </div>
          ) : groupExpenses.length === 0 ? (
            <p style={{ color: "var(--text-3)", textAlign: "center", padding: "1.5rem 0", fontSize: "0.85rem" }}>
              No transactions recorded in this group.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "0.5rem" }}>
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
                      padding: "0.85rem 1rem",
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
                        <span style={{ fontWeight: "600", fontSize: "0.9rem", display: "block" }}>
                          {expense.description}
                        </span>
                        <span style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>
                          Paid by {payerName} on {formatDateLabel(expense.expense_date)}
                        </span>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontWeight: "700", color: "var(--text-1)", fontSize: "0.95rem" }}>
                          ₹{parseFloat(expense.amount_inr).toFixed(2)}
                        </span>
                        {isUSD && (
                          <span style={{ fontSize: "0.68rem", color: "var(--text-3)", display: "block" }}>
                            Original: ${parseFloat(expense.original_amount).toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div
                        style={{
                          marginTop: "0.75rem",
                          paddingTop: "0.5rem",
                          borderTop: "1px solid var(--border)",
                          animation: "fadeIn 0.15s ease-out",
                        }}
                      >
                        <p style={{ fontSize: "0.75rem", color: "var(--text-3)", marginBottom: "0.4rem" }}>
                          Split Method: <span style={{ textTransform: "capitalize" }}>{expense.split_type}</span>
                        </p>
                        {expense.notes && (
                          <p style={{ fontSize: "0.8rem", color: "var(--text-2)", marginBottom: "0.5rem", background: "rgba(0,0,0,0.15)", padding: "0.4rem", borderRadius: "4px" }}>
                            <strong>Notes:</strong> {expense.notes}
                          </p>
                        )}
                        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
                          {expense.shares.map((share) => (
                            <div
                              key={share.id}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                fontSize: "0.8rem",
                                background: "rgba(255,255,255,0.01)",
                                padding: "0.25rem 0.4rem",
                                borderRadius: "4px",
                              }}
                            >
                              <span>{share.user.name}</span>
                              <div style={{ display: "flex", gap: "0.75rem" }}>
                                <span style={{ fontSize: "0.72rem", color: "var(--text-3)" }}>
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

        {/* Balance Drilldown Verification Modal (Rohan's Traceability) */}
        {selectedDrilldownUser && (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: "600px", padding: "1.75rem" }}>
              <div className="modal-header">
                <h3 className="modal-title">Audit Log — {selectedDrilldownUser.name}</h3>
                <button className="modal-close" onClick={() => setSelectedDrilldownUser(null)}>&times;</button>
              </div>

              {drilldownLoading ? (
                <div className="check-list" style={{ justifyContent: "center", padding: "2rem" }}>
                  <div className="loading-spinner" style={{ margin: "auto" }} />
                </div>
              ) : !drilldownData ? (
                <p>Failed to load audit logs.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem", maxHeight: "450px", overflowY: "auto", paddingRight: "0.5rem" }}>
                  {/* Math recap formula */}
                  <div
                    style={{
                      background: "var(--surface-2)",
                      border: "1px solid var(--border)",
                      borderRadius: "10px",
                      padding: "1rem",
                      fontSize: "0.85rem",
                      textAlign: "center",
                    }}
                  >
                    <span style={{ color: "var(--text-3)", display: "block", marginBottom: "0.4rem" }}>ACCOUNTING FORMULA</span>
                    <div style={{ fontWeight: "700", fontSize: "1rem" }}>
                      Paid (₹{drilldownData.expenses_paid.reduce((acc, e) => acc + parseFloat(e.amount_inr), 0).toFixed(2)}) 
                      - Owed (₹{drilldownData.shares_owed.reduce((acc, s) => acc + parseFloat(s.share_amount_inr), 0).toFixed(2)}) 
                      + Settled Paid (₹{drilldownData.settlements_paid.reduce((acc, s) => acc + parseFloat(s.amount_inr), 0).toFixed(2)}) 
                      - Settled Recv (₹{drilldownData.settlements_received.reduce((acc, s) => acc + parseFloat(s.amount_inr), 0).toFixed(2)})
                    </div>
                    <div style={{ marginTop: "0.5rem", fontSize: "1.1rem", color: selectedDrilldownUser.net_balance >= 0 ? "var(--success)" : "var(--error)", fontWeight: "800" }}>
                      = Net: {selectedDrilldownUser.net_balance >= 0 ? "+" : ""}
                      {selectedDrilldownUser.net_balance.toFixed(2)} INR
                    </div>
                  </div>

                  {/* Expenses Paid section */}
                  <div>
                    <h4 style={{ fontSize: "0.88rem", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-3)", borderBottom: "1px solid var(--border)", paddingBottom: "0.25rem" }}>
                      1. Expenses Paid (Lent)
                    </h4>
                    {drilldownData.expenses_paid.length === 0 ? (
                      <p style={{ fontSize: "0.8rem", color: "var(--text-3)", marginTop: "0.25rem" }}>No expenses paid.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.4rem" }}>
                        {drilldownData.expenses_paid.map((e) => (
                          <div key={e.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                            <span>{e.description} <small style={{ color: "var(--text-3)" }}>({formatDateLabel(e.expense_date)})</small></span>
                            <span style={{ fontWeight: "600" }}>+₹{parseFloat(e.amount_inr).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Shares Owed section */}
                  <div>
                    <h4 style={{ fontSize: "0.88rem", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-3)", borderBottom: "1px solid var(--border)", paddingBottom: "0.25rem" }}>
                      2. Shares Owed (Consumed)
                    </h4>
                    {drilldownData.shares_owed.length === 0 ? (
                      <p style={{ fontSize: "0.8rem", color: "var(--text-3)", marginTop: "0.25rem" }}>No shares owed.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.4rem" }}>
                        {drilldownData.shares_owed.map((s) => (
                          <div key={s.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem" }}>
                            <span>
                              {s.expense_description}{" "}
                              <small style={{ color: "var(--text-3)" }}>
                                ({formatDateLabel(s.expense_date)} • {s.share_raw})
                              </small>
                            </span>
                            <span style={{ color: "var(--text-2)" }}>-₹{parseFloat(s.share_amount_inr).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Settlements Paid/Received */}
                  <div>
                    <h4 style={{ fontSize: "0.88rem", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-3)", borderBottom: "1px solid var(--border)", paddingBottom: "0.25rem" }}>
                      3. Settlements (Payments)
                    </h4>
                    {drilldownData.settlements_paid.length === 0 && drilldownData.settlements_received.length === 0 ? (
                      <p style={{ fontSize: "0.8rem", color: "var(--text-3)", marginTop: "0.25rem" }}>No settlements recorded.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: "0.4rem" }}>
                        {drilldownData.settlements_paid.map((s) => (
                          <div key={s.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--success)" }}>
                            <span>Paid to {s.paid_to_name} <small style={{ color: "var(--text-3)" }}>({formatDateLabel(s.settled_at)})</small></span>
                            <span style={{ fontWeight: "600" }}>+₹{parseFloat(s.amount_inr).toFixed(2)}</span>
                          </div>
                        ))}
                        {drilldownData.settlements_received.map((s) => (
                          <div key={s.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", color: "var(--error)" }}>
                            <span>Received from {s.paid_by_name} <small style={{ color: "var(--text-3)" }}>({formatDateLabel(s.settled_at)})</small></span>
                            <span style={{ fontWeight: "600" }}>-₹{parseFloat(s.amount_inr).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="modal-footer" style={{ borderTop: "1px solid var(--border)", paddingTop: "1rem", marginTop: "1rem" }}>
                <button className="btn-primary" style={{ width: "auto" }} onClick={() => setSelectedDrilldownUser(null)}>
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Record Settlement Modal (Settle Up) */}
        {showSettleModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3 className="modal-title">Record Settlement</h3>
                <button className="modal-close" onClick={() => setShowSettleModal(false)}>&times;</button>
              </div>

              <form onSubmit={handleRecordSettlement} className="auth-form">
                <div className="field">
                  <label htmlFor="settle-from">Who Paid (Sender)</label>
                  <select
                    id="settle-from"
                    value={settleSender}
                    onChange={(e) => setSettleSender(e.target.value)}
                    required
                  >
                    <option value="">-- Select Sender --</option>
                    {selectedGroup.memberships.map((m) => (
                      <option key={m.user.id} value={m.user.id}>
                        {m.user.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="settle-to">Who Was Paid (Recipient)</label>
                  <select
                    id="settle-to"
                    value={settleRecipient}
                    onChange={(e) => setSettleRecipient(e.target.value)}
                    required
                  >
                    <option value="">-- Select Recipient --</option>
                    {selectedGroup.memberships.map((m) => (
                      <option key={m.user.id} value={m.user.id}>
                        {m.user.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="settle-amount">Amount (INR)</label>
                  <input
                    id="settle-amount"
                    type="number"
                    step="0.01"
                    placeholder="₹ 0.00"
                    value={settleAmount}
                    onChange={(e) => setSettleAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="settle-date">Settled Date</label>
                  <input
                    id="settle-date"
                    type="date"
                    value={settleDate}
                    onChange={(e) => setSettleDate(e.target.value)}
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="settle-notes">Notes</label>
                  <input
                    id="settle-notes"
                    type="text"
                    placeholder="e.g. Settle taxi split, cash payment"
                    value={settleNotes}
                    onChange={(e) => setSettleNotes(e.target.value)}
                  />
                </div>

                {formError && (
                  <div className="auth-error">
                    <span className="auth-error-icon">⚠️</span>
                    <span>{formError}</span>
                  </div>
                )}

                <div className="modal-footer">
                  <button type="button" className="btn-secondary" onClick={() => setShowSettleModal(false)} disabled={submitting}>Cancel</button>
                  <button type="submit" className="btn-primary" style={{ width: "auto" }} disabled={submitting}>
                    {submitting ? "Saving..." : "Record Payment"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Member Modal */}
        {showAddMemberModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3 className="modal-title">Add Group Member</h3>
                <button className="modal-close" onClick={() => setShowAddMemberModal(false)}>&times;</button>
              </div>

              {/* Tab toggles */}
              <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" }}>
                <button
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    color: !isCreatingNewUser ? "var(--primary)" : "var(--text-2)",
                    fontWeight: !isCreatingNewUser ? "600" : "400",
                    borderBottom: !isCreatingNewUser ? "2px solid var(--primary)" : "none",
                    paddingBottom: "0.5rem",
                    cursor: "pointer",
                    fontSize: "0.95rem"
                  }}
                  onClick={() => {
                    setIsCreatingNewUser(false);
                    setFormError("");
                  }}
                >
                  Existing User
                </button>
                <button
                  type="button"
                  style={{
                    background: "none",
                    border: "none",
                    color: isCreatingNewUser ? "var(--primary)" : "var(--text-2)",
                    fontWeight: isCreatingNewUser ? "600" : "400",
                    borderBottom: isCreatingNewUser ? "2px solid var(--primary)" : "none",
                    paddingBottom: "0.5rem",
                    cursor: "pointer",
                    fontSize: "0.95rem"
                  }}
                  onClick={() => {
                    setIsCreatingNewUser(true);
                    setFormError("");
                  }}
                >
                  Create New User
                </button>
              </div>

              <form onSubmit={handleAddMember} className="auth-form">
                {!isCreatingNewUser ? (
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
                ) : (
                  <>
                    <div className="field">
                      <label htmlFor="new-user-name">Full Name</label>
                      <input
                        id="new-user-name"
                        type="text"
                        placeholder="e.g. Aisha"
                        value={newUserName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNewUserName(val);
                          // Auto-generate email from name if unmodified/empty
                          const cleanName = val.replace(/\s+/g, "").toLowerCase();
                          setNewUserEmail(cleanName ? `${cleanName}@example.com` : "");
                        }}
                        required
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="new-user-email">Email Address</label>
                      <input
                        id="new-user-email"
                        type="email"
                        placeholder="e.g. aisha@example.com"
                        value={newUserEmail}
                        onChange={(e) => setNewUserEmail(e.target.value)}
                        required
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="new-user-password">Password</label>
                      <input
                        id="new-user-password"
                        type="password"
                        placeholder="Min 8 characters"
                        value={newUserPassword}
                        onChange={(e) => setNewUserPassword(e.target.value)}
                        required
                      />
                      <small style={{ color: "var(--text-3)", fontSize: "0.75rem", marginTop: "0.25rem", display: "block" }}>
                        Password for this member to log in later.
                      </small>
                    </div>
                  </>
                )}

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
                      setSplitValues({});
                    }}
                    required
                  />
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
