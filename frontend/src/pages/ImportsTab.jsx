import { useState, useEffect } from "react";
import { api } from "../api/client";

export default function ImportsTab() {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [groupMembers, setGroupMembers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  
  // File upload state
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  
  // Import report state
  const [report, setReport] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Selected payer mapping for resolving missing payer anomalies
  const [selectedPayers, setSelectedPayers] = useState({});

  useEffect(() => {
    // Fetch user groups
    api.get("/groups/")
      .then((data) => {
        setGroups(data);
        if (data.length > 0) {
          setSelectedGroup(data[0].id.toString());
        }
      })
      .catch((err) => console.error("Error fetching groups:", err));

    // Fetch all system users
    api.get("/auth/users/")
      .then((data) => {
        setAllUsers(data || []);
      })
      .catch((err) => console.error("Error fetching system users:", err));
  }, []);

  useEffect(() => {
    if (selectedGroup) {
      // Fetch members of the selected group
      api.get(`/groups/${selectedGroup}/members/`)
        .then((data) => {
          // data is list of memberships: { id, user: { id, name, email }, joined_at, left_at }
          const membersList = data.map((m) => m.user);
          setGroupMembers(membersList);
        })
        .catch((err) => console.error("Error fetching group members:", err));
    }
  }, [selectedGroup]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedGroup) {
      setError("Please select a group first.");
      return;
    }
    if (!file) {
      setError("Please select or drop a CSV file to upload.");
      return;
    }

    setLoading(true);
    setError("");
    setReport(null);

    const formData = new FormData();
    formData.append("group", selectedGroup);
    formData.append("file", file);

    try {
      const result = await api.upload("/imports/upload/", formData);
      setReport(result);
      // Reset selected payers
      setSelectedPayers({});
    } catch (err) {
      console.error(err);
      setError(err?.error || "Failed to upload and process CSV file.");
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (anomalyId, action) => {
    const payload = { action, group_id: selectedGroup };
    
    if (action === "approve") {
      const selectedPayerId = selectedPayers[anomalyId];
      // For missing payer, ensure a payer has been selected
      const anomaly = report.anomalies.find(a => a.id === anomalyId);
      if (anomaly && anomaly.type === "missing_payer") {
        if (!selectedPayerId) {
          alert("Please select a payer to approve this row.");
          return;
        }
        payload.payer_id = selectedPayerId;
      }
    }

    try {
      const result = await api.post(`/imports/anomalies/${anomalyId}/resolve/`, payload);
      // Update local anomaly status in report
      setReport((prevReport) => {
        if (!prevReport) return null;
        const updatedAnomalies = prevReport.anomalies.map((anom) => {
          if (anom.id === anomalyId) {
            return {
              ...anom,
              status: "resolved",
              applied_policy: result.policy || (action === "approve" ? "Manually approved" : "Rejected by user")
            };
          }
          return anom;
        });
        return {
          ...prevReport,
          anomalies: updatedAnomalies
        };
      });
    } catch (err) {
      console.error(err);
      alert(err?.error || "Failed to resolve anomaly.");
    }
  };

  return (
    <div style={{ padding: "1.5rem", maxWidth: "1200px", margin: "0 auto" }}>
      {/* Selection & Upload panel */}
      <div className="card" style={{ marginBottom: "2rem" }}>
        <h2 className="card-title" style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span>📥</span> Import Expenses from CSV
        </h2>
        <p className="card-desc">
          Upload your Splitwise/shared expenses CSV file. Antigravity's engine will automatically analyze and resolve 17 types of anomalies (duplicate entries, currency conversions, timeline checks, and name inconsistencies) before importing clean records.
        </p>

        <form onSubmit={handleUpload}>
          <div className="form-group" style={{ marginBottom: "1.5rem" }}>
            <label htmlFor="group-select" className="form-label" style={{ fontWeight: "bold" }}>Target Expense Group:</label>
            <select
              id="group-select"
              className="form-control"
              style={{ width: "100%", padding: "0.5rem", borderRadius: "4px" }}
              value={selectedGroup}
              onChange={(e) => setSelectedGroup(e.target.value)}
              disabled={loading}
            >
              <option value="">-- Select a Group --</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>

          <div
            className={`file-dropzone ${dragActive ? "file-dropzone--active" : ""}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            style={{
              border: "2px dashed #cbd5e1",
              borderRadius: "8px",
              padding: "2.5rem 1.5rem",
              textAlign: "center",
              cursor: "pointer",
              backgroundColor: dragActive ? "#f1f5f9" : "#fff",
              transition: "all 0.2s ease",
              marginBottom: "1.5rem"
            }}
            onClick={() => document.getElementById("file-input").click()}
          >
            <input
              id="file-input"
              type="file"
              accept=".csv"
              style={{ display: "none" }}
              onChange={handleFileChange}
              disabled={loading}
            />
            <span style={{ fontSize: "2.5rem", display: "block", marginBottom: "0.5rem" }}>📄</span>
            {file ? (
              <div>
                <strong style={{ color: "#3b82f6" }}>{file.name}</strong>
                <span style={{ display: "block", fontSize: "0.85rem", color: "#64748b", marginTop: "0.25rem" }}>
                  {(file.size / 1024).toFixed(1)} KB — click or drag to replace
                </span>
              </div>
            ) : (
              <div>
                <strong>Drag and drop your CSV file here</strong>
                <span style={{ display: "block", fontSize: "0.85rem", color: "#64748b", marginTop: "0.25rem" }}>
                  or click to browse from your computer
                </span>
              </div>
            )}
          </div>

          {error && (
            <div style={{ padding: "0.75rem", backgroundColor: "#fef2f2", color: "#b91c1c", borderRadius: "6px", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            style={{ width: "100%", padding: "0.75rem", fontWeight: "bold" }}
            disabled={loading || !file || !selectedGroup}
          >
            {loading ? "Processing rules engine..." : "Process & Import CSV"}
          </button>
        </form>
      </div>

      {/* Report Panel */}
      {report && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "1rem", marginBottom: "1.5rem" }}>
            <div>
              <h2 className="card-title" style={{ margin: 0 }}>📊 Import Batch Report</h2>
              <p className="card-desc" style={{ margin: 0, marginTop: "0.25rem" }}>
                Batch #{report.batch_id} processed successfully.
              </p>
            </div>
            <div style={{ display: "flex", gap: "1rem" }}>
              <div style={{ textAlign: "center", backgroundColor: "#f8fafc", padding: "0.5rem 1rem", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                <span style={{ display: "block", fontSize: "0.75rem", color: "#64748b", textTransform: "uppercase" }}>Rows Read</span>
                <strong style={{ fontSize: "1.25rem", color: "#0f172a" }}>{report.row_count}</strong>
              </div>
              <div style={{ textAlign: "center", backgroundColor: "#fef3c7", padding: "0.5rem 1rem", borderRadius: "6px", border: "1px solid #fde68a" }}>
                <span style={{ display: "block", fontSize: "0.75rem", color: "#b45309", textTransform: "uppercase" }}>Anomalies Found</span>
                <strong style={{ fontSize: "1.25rem", color: "#b45309" }}>{report.anomaly_count}</strong>
              </div>
            </div>
          </div>

          {report.anomalies.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "#16a34a", backgroundColor: "#f0fdf4", borderRadius: "8px" }}>
              <strong>🎉 Perfect Import! No anomalies found.</strong>
              <p style={{ margin: 0, marginTop: "0.25rem", fontSize: "0.9rem" }}>All transactions were imported smoothly into the database.</p>
            </div>
          ) : (
            <div>
              <h3 style={{ fontSize: "1.1rem", marginBottom: "1rem", color: "#0f172a" }}>Logged Anomalies & Decisions</h3>
              <div className="table-container" style={{ overflowX: "auto" }}>
                <table className="table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                      <th style={{ padding: "0.75rem" }}>Row</th>
                      <th style={{ padding: "0.75rem" }}>Anomaly Type</th>
                      <th style={{ padding: "0.75rem" }}>Description</th>
                      <th style={{ padding: "0.75rem" }}>Applied Policy</th>
                      <th style={{ padding: "0.75rem" }}>Status</th>
                      <th style={{ padding: "0.75rem", textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.anomalies.map((anom) => (
                      <tr key={anom.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                        <td style={{ padding: "0.75rem", fontWeight: "600", color: "#475569" }}>{anom.row_number}</td>
                        <td style={{ padding: "0.75rem" }}>
                          <span className={`badge badge--anomaly-${anom.type}`} style={{
                            fontSize: "0.75rem",
                            padding: "0.2rem 0.5rem",
                            borderRadius: "4px",
                            fontWeight: "bold",
                            backgroundColor: "#fee2e2",
                            color: "#991b1b"
                          }}>
                            {anom.type.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem", fontSize: "0.9rem", color: "#334155" }}>{anom.description}</td>
                        <td style={{ padding: "0.75rem", fontSize: "0.9rem", fontStyle: "italic", color: "#475569" }}>{anom.applied_policy}</td>
                        <td style={{ padding: "0.75rem" }}>
                          <span style={{
                            fontSize: "0.8rem",
                            padding: "0.25rem 0.5rem",
                            borderRadius: "9999px",
                            fontWeight: "500",
                            backgroundColor: anom.status === "needs_review" ? "#fef3c7" : anom.status === "resolved" ? "#dcfce7" : "#e2e8f0",
                            color: anom.status === "needs_review" ? "#92400e" : anom.status === "resolved" ? "#166534" : "#475569"
                          }}>
                            {anom.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem", textAlign: "right" }}>
                          {anom.status === "needs_review" ? (
                            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", alignItems: "center" }}>
                              {anom.type === "missing_payer" && (
                                <select
                                  value={selectedPayers[anom.id] || ""}
                                  onChange={(e) => setSelectedPayers({ ...selectedPayers, [anom.id]: e.target.value })}
                                  style={{ padding: "0.25rem", borderRadius: "4px", fontSize: "0.85rem", border: "1px solid #cbd5e1" }}
                                >
                                  <option value="">-- Select Payer --</option>
                                  {allUsers.map((u) => (
                                    <option key={u.id} value={u.id}>
                                      {u.name}
                                    </option>
                                  ))}
                                </select>
                              )}
                              <button
                                onClick={() => handleResolve(anom.id, "approve")}
                                className="btn-primary"
                                style={{ padding: "0.25rem 0.6rem", fontSize: "0.8rem" }}
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleResolve(anom.id, "reject")}
                                className="btn-secondary"
                                style={{ padding: "0.25rem 0.6rem", fontSize: "0.8rem", color: "#dc2626" }}
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span style={{ color: "#94a3b8", fontSize: "0.85rem" }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
