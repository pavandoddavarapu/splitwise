import { useState, useEffect } from "react";
import { api } from "../api/client";

export default function GroupsTab() {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // UI state
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [users, setUsers] = useState([]);

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showEditMemberModal, setShowEditMemberModal] = useState(null); // holds membership to edit

  // Form states
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [joinedAt, setJoinedAt] = useState(new Date().toISOString().split("T")[0]);
  const [leftAt, setLeftAt] = useState("");

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

  useEffect(() => {
    fetchGroups();
    fetchUsers();
  }, []);

  // Sync selected group detail if groups refresh
  useEffect(() => {
    if (selectedGroup) {
      const updated = groups.find((g) => g.id === selectedGroup.id);
      if (updated) setSelectedGroup(updated);
    }
  }, [groups]);

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
      // Select the newly created group to allow adding members immediately
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

  // Format Date for display
  const formatDate = (dateString) => {
    if (!dateString) return "Present";
    return new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // Filter out users already in the selected group for the Add Member dropdown
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
    return (
      <div>
        <div className="action-bar">
          <button className="btn-secondary" onClick={() => setSelectedGroup(null)}>
            ← Back to Groups
          </button>
          <button
            className="btn-primary"
            style={{ width: "auto" }}
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
        </div>

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

        {/* Add Member Modal */}
        {showAddMemberModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h3 className="modal-title">Add Group Member</h3>
                <button
                  className="modal-close"
                  onClick={() => setShowAddMemberModal(false)}
                >
                  &times;
                </button>
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
                  <span style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>
                    Leave blank if still active in group.
                  </span>
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
                    onClick={() => setShowAddMemberModal(false)}
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
                <button
                  className="modal-close"
                  onClick={() => setShowEditMemberModal(null)}
                >
                  &times;
                </button>
              </div>

              <form onSubmit={handleEditMember} className="auth-form">
                <div className="field">
                  <label>User</label>
                  <input
                    type="text"
                    value={showEditMemberModal.user.name}
                    disabled
                    style={{ opacity: 0.7 }}
                  />
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
                  <span style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>
                    Leave blank if still active in group.
                  </span>
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
                    onClick={() => setShowEditMemberModal(null)}
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
                    {submitting ? "Saving..." : "Save Changes"}
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
