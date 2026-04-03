import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { getAllComplaints, updateComplaintStatus, syncOverdueStatus } from "./firestore.js";

// ─── ADMIN EMAIL REMOVED ─────────────────────────────────────────────────────

// ─── SHARED: STATUS TIMELINE ─────────────────────────────────────────────────
const STATUS_STEPS = [
  { key: "SENT",     label: "Sent",     color: "#f5c542", border: "rgba(245,197,66,0.35)",  bg: "rgba(245,197,66,0.1)" },
  { key: "WORKING",  label: "Working",  color: "#60a5fa", border: "rgba(96,165,250,0.35)",  bg: "rgba(96,165,250,0.1)" },
  { key: "RESOLVED", label: "Resolved", color: "#3ecf8e", border: "rgba(62,207,142,0.35)", bg: "rgba(62,207,142,0.1)" },
];
const STATUS_ORDER = { SENT: 0, PENDING: 0, WORKING: 1, RESOLVED: 2, OVERDUE: 1 };

function StatusTimeline({ status }) {
  const currentIdx = STATUS_ORDER[status] ?? 0;
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {STATUS_STEPS.map((step, i) => {
        const active = i <= currentIdx;
        const isCurrent = i === currentIdx;
        const isOverdue = status === "OVERDUE" && i <= 1;
        return (
          <div key={step.key} style={{ display: "flex", alignItems: "center", flex: i < 2 ? 1 : "unset" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, minWidth: 64 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: active ? (isOverdue ? "rgba(255,77,77,0.1)" : step.bg) : "rgba(255,255,255,0.04)",
                border: `1.5px solid ${active ? (isOverdue ? "rgba(255,77,77,0.3)" : step.border) : "rgba(255,255,255,0.08)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: isCurrent ? (status === "OVERDUE" ? "0 0 16px rgba(255,77,77,0.4)" : `0 0 16px ${step.color}66`) : "none",
                transition: "all 0.3s",
              }}>
                {active
                  ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={isOverdue ? "#ff6b6b" : step.color} strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                  : <div style={{ width: 7, height: 7, borderRadius: "50%", background: "rgba(255,255,255,0.1)" }} />
                }
              </div>
              <span style={{
                fontSize: 9, letterSpacing: "1px", textTransform: "uppercase",
                fontFamily: "'IBM Plex Mono',monospace",
                color: active ? (isOverdue ? "#ff6b6b" : step.color) : "rgba(160,175,210,0.25)",
                fontWeight: isCurrent ? 700 : 400,
              }}>{step.label}</span>
            </div>
            {i < 2 && <div style={{
              flex: 1, height: 2, marginBottom: 18, marginLeft: 2, marginRight: 2,
              background: i < currentIdx
                ? `linear-gradient(90deg,${STATUS_STEPS[i].color},${STATUS_STEPS[i+1].color})`
                : "rgba(255,255,255,0.07)",
              borderRadius: 2, transition: "background 0.4s",
            }} />}
          </div>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }) {
  const cfg = {
    RESOLVED: { bg: "rgba(62,207,142,0.1)",  border: "rgba(62,207,142,0.3)",  color: "#3ecf8e" },
    WORKING:  { bg: "rgba(96,165,250,0.1)",  border: "rgba(96,165,250,0.3)",  color: "#60a5fa" },
    SENT:     { bg: "rgba(245,197,66,0.1)",  border: "rgba(245,197,66,0.3)",  color: "#f5c542" },
    PENDING:  { bg: "rgba(245,197,66,0.1)",  border: "rgba(245,197,66,0.3)",  color: "#f5c542" },
    OVERDUE:  { bg: "rgba(255,77,77,0.1)",   border: "rgba(255,77,77,0.3)",   color: "#ff4d4d" },
  };
  const s = cfg[status] || cfg.SENT;
  const label = status === "OVERDUE" ? "OVERDUE ❌" : (status || "SENT");
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "1px", padding: "4px 10px", borderRadius: 100,
      fontFamily: "'IBM Plex Mono',monospace",
      background: s.bg, border: `1px solid ${s.border}`, color: s.color,
      transition: "all 0.3s cubic-bezier(0.4,0,0.2,1)",
    }}>{label}</span>
  );
}

// ─── HELPER: PROCESS OVERDUE ──────────────────────────────────────────────────
function processComplaints(list) {
  const now = Date.now();
  const FORTY_EIGHT_HOURS = 48 * 60 * 60 * 1000;
  return list.map(c => {
    if (c.status !== "RESOLVED" && (now - c.timestamp.getTime()) > FORTY_EIGHT_HOURS) {
      return { ...c, status: "OVERDUE" };
    }
    return c;
  });
}

// ─── SHARED: PAGE SHELL ───────────────────────────────────────────────────────
function PageShell({ user, children, title, subtitle }) {
  const loc = useLocation();
  const navItems = [
    { to: "/", label: "Dashboard", icon: "◈" },
    { to: "/history", label: "History", icon: "⊞" },
    { to: "/pending", label: "Pending", icon: "◉" },
    { to: "/location-risks", label: "Location Risks", icon: "📍" },
    { to: "/admin", label: "Admin Portal", icon: "🛡️" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#070b14", fontFamily: "'Inter',sans-serif", position: "relative", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        @keyframes fadeUp   { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
      `}</style>

      {/* Simplified Background UI */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(circle at 0% 0%, rgba(59,130,246,0.05), transparent 50%), radial-gradient(circle at 100% 100%, rgba(99,102,241,0.05), transparent 50%)" }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1360, margin: "0 auto", padding: "0 28px 60px" }}>
        {/* ── HEADER ── */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "22px 0 20px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          marginBottom: 32,
          position: "sticky", top: 0, zIndex: 50,
          backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
          background: "rgba(7,11,20,0.7)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Link to="/" style={{ textDecoration: "none" }}>
              <div style={{
                width: 42, height: 42, borderRadius: 12,
                background: "linear-gradient(135deg, #1d4ed8 0%, #3b82f6 50%, #818cf8 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 0 24px rgba(59,130,246,0.4)",
                fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, fontWeight: 500, color: "#fff", letterSpacing: "-0.5px",
              }}>OR</div>
            </Link>
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: "#eef2ff", letterSpacing: "-0.5px" }}>ORCA</span>
                <span style={{ fontSize: 12, color: "rgba(160,175,210,0.4)", fontFamily: "'IBM Plex Mono',monospace" }}>v2.1.0</span>
              </div>
              <div style={{ fontSize: 11, color: "rgba(160,175,210,0.45)", letterSpacing: "1.2px", textTransform: "uppercase", fontFamily: "'IBM Plex Mono',monospace" }}>Operational Risk Control Agent</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {navItems.map(({ to, label, icon }) => {
              const active = loc.pathname === to;
              return (
                <Link key={to} to={to} style={{ textDecoration: "none" }}>
                  <div style={{ 
                    display: "flex", alignItems: "center", gap: 7, 
                    padding: "8px 16px", borderRadius: 10, 
                    background: active ? "rgba(59,130,246,0.15)" : "transparent", 
                    border: `1px solid ${active ? "rgba(59,130,246,0.3)" : "transparent"}`, 
                    color: active ? "#93c5fd" : "rgba(160,175,210,0.5)", 
                    fontSize: 13, fontWeight: active ? 600 : 400,
                    transition: "all 0.2s"
                  }}>
                    <span style={{ fontSize: 10 }}>{icon}</span> {label}
                  </div>
                </Link>
              );
            })}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(62,207,142,0.07)", border: "1px solid rgba(62,207,142,0.2)",
              borderRadius: 100, padding: "7px 14px", fontSize: 12, fontWeight: 500, color: "#6edfa8",
            }}>
              <style>{`
                @keyframes pulse2 { 0% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.5); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
              `}</style>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#3ecf8e", boxShadow: "0 0 8px #3ecf8e", animation: "pulse2 2s infinite" }} />
              System Active
            </div>

            {user && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 4, borderLeft: "1px solid rgba(255,255,255,0.07)", marginLeft: 4 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: "linear-gradient(135deg,#1d4ed8,#818cf8)",
                  border: "1.5px solid rgba(59,130,246,0.4)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, color: "#fff",
                }}>
                  {(user.displayName || "P")[0].toUpperCase()}
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "rgba(220,230,255,0.9)", lineHeight: 1.2 }}>
                    {user.displayName || "Public Operator"}
                  </span>
                  <span style={{ fontSize: 10, color: "rgba(160,175,210,0.4)", textTransform: "uppercase", letterSpacing: "1px", fontWeight: 500 }}>
                    Global Access Active
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "#eef2ff" }}>{title}</h1>
          {subtitle && <div style={{ fontSize: 13, color: "rgba(160,175,210,0.4)", fontFamily: "'IBM Plex Mono',monospace" }}>{subtitle}</div>}
        </div>

        {children}
      </div>
    </div>
  );
}

// ─── SHARED: DETAIL VIEW ──────────────────────────────────────────────────────
function ComplaintDetail({ complaint, onBack }) {
  return (
    <div style={{ maxWidth: 800, animation: "fadeUp 0.3s ease both" }}>
      <button onClick={onBack} style={{ background: "none", border: "none", color: "#60a5fa", cursor: "pointer", marginBottom: 20 }}>← Back to stream</button>
      <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 20, padding: 32 }}>
        <div style={{ fontSize: 18, color: "#fff", marginBottom: 24, lineHeight: 1.5 }}>{complaint.description}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 32 }}>
          {[
            { l: "Complaint ID", v: complaint.complaint_id || "N/A" },
            { l: "Status", v: complaint.status },
            { l: "Department", v: complaint.department },
            { l: "Issue Type", v: complaint.issue_type },
          ].map(x => (
            <div key={x.l} style={{ background: "rgba(255,255,255,0.03)", padding: 16, borderRadius: 12 }}>
              <div style={{ fontSize: 9, color: "rgba(160,175,210,0.4)", textTransform: "uppercase", marginBottom: 4 }}>{x.l}</div>
              <div style={{ color: "#fff", fontSize: 14, fontWeight: 600 }}>{x.v}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 10, color: "rgba(160,175,210,0.4)", marginBottom: 12 }}>ENFORCEMENT PROGRESS</div>
        <StatusTimeline status={complaint.status} />
      </div>
    </div>
  );
}

// ─── ADMIN PAGE ───────────────────────────────────────────────────────────────
export function AdminPage({ user }) {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getAllComplaints();
      const processed = processComplaints(data);
      setComplaints(processed);
      
      // BACKGROUND SYNC: Persist OVERDUE status back to Firestore if condition met
      syncOverdueStatus(processed).then(updated => {
        if (updated) console.log("🔄 Firestore synchronized with overdue thresholds.");
      });
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleUpdate = async (path, status) => {
    if (loading) return;
    setLoading(true);
    try {
      await updateComplaintStatus(path, status);
      await load();
    } catch (e) {
      alert("Terminal sync error. Please retry.");
    }
    setLoading(false);
  };

  return (
    <PageShell user={user} title="Global Administration" subtitle={`Monitoring ${complaints.length} active system records`}>
      {loading ? <div style={{ color: "rgba(255,255,255,0.3)", padding: 40, fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, animation: "critPulse 2s infinite" }}>SYNCING GLOBAL INTELLIGENCE...</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16, animation: "fadeUp 0.4s ease both" }}>
          {complaints.length === 0 ? (
            <div style={{ padding: 40, border: "2px dashed rgba(255,255,255,0.05)", borderRadius: 16, color: "rgba(160,175,210,0.3)", textAlign: "center", fontSize: 13, fontFamily: "'IBM Plex Mono',monospace" }}>NO COMPLAINTS DETECTED. SYSTEM STATUS: NOMINAL.</div>
          ) : complaints.map((c) => (
            <div key={c.id} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ color: "#fff", fontWeight: 700 }}>{c.description}</div>
                <StatusBadge status={c.status} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 16, color: "rgba(255,255,255,0.5)", fontSize: 11 }}>
                <div><span style={{ fontSize: 9 }}>TRACKING ID:</span> <span style={{ color: "#818cf8", fontWeight: 700 }}>{c.complaint_id || "N/A"}</span></div>
                <div><span style={{ fontSize: 9 }}>USER:</span> {c.user_email}</div>
                <div><span style={{ fontSize: 9 }}>DEPT:</span> {c.department}</div>
                <div><span style={{ fontSize: 9 }}>TIMESTAMP:</span> {c.timestamp.toLocaleString()}</div>
              </div>
              {c.status !== "RESOLVED" && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => handleUpdate(c.path, "WORKING")} style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(96,165,250,0.1)", border: "1px solid rgba(96,165,250,0.3)", color: "#93c5fd", cursor: "pointer" }}>Mark Working</button>
                  <button onClick={() => handleUpdate(c.path, "RESOLVED")} style={{ padding: "6px 12px", borderRadius: 8, background: "rgba(62,207,142,0.1)", border: "1px solid rgba(62,207,142,0.3)", color: "#6edfa8", cursor: "pointer" }}>Resolve Issue</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}

// ─── PENDING PAGE (Public) ────────────────────────────────────────────────────
export function PendingPage({ user }) {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    getAllComplaints().then(all => {
      setComplaints(processComplaints(all).filter(c => c.status === "OVERDUE"));
      setLoading(false);
    });
  }, []);

  return (
    <PageShell user={user} title="Public Safety Stream" subtitle={`${complaints.length} overdue incidents requiring resolution`}>
      {selected ? <ComplaintDetail complaint={selected} onBack={() => setSelected(null)} /> : (
        loading ? <div style={{ color: "rgba(255,255,255,0.3)", padding: 40, fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, animation: "critPulse 2s infinite" }}>INITIALIZING PUBLIC STREAM...</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "fadeUp 0.4s ease both" }}>
            {complaints.length === 0 ? (
              <div style={{ padding: 40, border: "2px dashed rgba(255,255,255,0.05)", borderRadius: 16, color: "rgba(160,175,210,0.3)", textAlign: "center", fontSize: 13, fontFamily: "'IBM Plex Mono',monospace" }}>NO OVERDUE ISSUES. SYSTEM IS OPERATING EFFICIENTLY.</div>
            ) : complaints.map((c, i) => (
              <div key={c.id} onClick={() => setSelected(c)} style={{ 
                background: c.status === "OVERDUE" ? "rgba(255,77,77,0.03)" : "rgba(255,255,255,0.01)", 
                border: `1px solid ${c.status === "OVERDUE" ? "rgba(255,77,77,0.15)" : "rgba(255,255,255,0.06)"}`, 
                borderRadius: 16, padding: 22, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                animation: `fadeUp 0.4s ease both ${i * 0.05}s`
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = c.status === "OVERDUE" ? "rgba(255,77,77,0.15)" : "rgba(255,255,255,0.06)"; }}
              >
                <div>
                  <div style={{ fontSize: 10, color: "#818cf8", fontWeight: 700, marginBottom: 4, fontFamily: "'IBM Plex Mono',monospace" }}>{c.complaint_id || "CIV-SYNC-001"}</div>
                  <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{c.description}</div>
                  <div style={{ color: "rgba(160,175,210,0.4)", fontSize: 11, marginTop: 4 }}>{c.department} • {getAge(c.timestamp).label}</div>
                </div>
                <StatusBadge status={c.status} />
              </div>
            ))}
          </div>
        )
      )}
    </PageShell>
  );
}

// ─── HISTORY PAGE ─────────────────────────────────────────────────────────────
export function HistoryPage({ user }) {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    getAllComplaints().then(d => { setComplaints(processComplaints(d)); setLoading(false); });
  }, []);

  return (
    <PageShell user={user} title="Public Global Stream" subtitle={`${complaints.length} aggregate incident reports`}>
      {selected ? <ComplaintDetail complaint={selected} onBack={() => setSelected(null)} /> : (
        loading ? <div style={{ color: "rgba(255,255,255,0.3)", padding: 40, fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, animation: "critPulse 2s infinite" }}>RETRIEVING PERSONAL LOGS...</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12, animation: "fadeUp 0.4s ease both" }}>
            {complaints.length === 0 ? (
              <div style={{ padding: 40, border: "2px dashed rgba(255,255,255,0.05)", borderRadius: 16, color: "rgba(160,175,210,0.3)", textAlign: "center", fontSize: 13, fontFamily: "'IBM Plex Mono',monospace" }}>NO COMPLAINTS YET. INITIALIZE YOUR FIRST REPORT FROM THE DASHBOARD.</div>
            ) : complaints.map((c, i) => (
              <div key={c.id} onClick={() => setSelected(c)} style={{ 
                background: "rgba(255,255,255,0.01)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 22, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                animation: `fadeUp 0.4s ease both ${i * 0.05}s`
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
              >
                <div>
                  <div style={{ fontSize: 10, color: "#818cf8", fontWeight: 700, marginBottom: 4, fontFamily: "'IBM Plex Mono',monospace" }}>{c.complaint_id || "CIV-LOG-000"}</div>
                  <div style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>{c.description}</div>
                  <div style={{ color: "rgba(160,175,210,0.4)", fontSize: 11, marginTop: 4 }}>{c.department} • {c.timestamp.toLocaleDateString()}</div>
                </div>
                <StatusBadge status={c.status} />
              </div>
            ))}
          </div>
        )
      )}
    </PageShell>
  );
}

// ─── LOCATION RISKS PAGE ──────────────────────────────────────────────────────
export function LocationRisksPage({ user }) {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState("");

  useEffect(() => {
    getAllComplaints().then(all => {
      setComplaints(processComplaints(all).filter(c => c.status !== "RESOLVED"));
      setLoading(false);
    });
  }, []);

  const filteredData = complaints.filter(c => 
    !userLocation || (c.location && c.location.toLowerCase().includes(userLocation.toLowerCase()))
  );

  return (
    <PageShell user={user} title="🚨 Location-Based Risk Alerts" subtitle="Spatial intelligence for active urban hazards">
      <div style={{ marginBottom: 24, animation: "fadeUp 0.4s ease both" }}>
        <div style={{ position: "relative", maxWidth: 500 }}>
          <input 
            type="text" 
            placeholder="Search by neighborhood or street (e.g. Downtown)..."
            value={userLocation}
            onChange={(e) => setUserLocation(e.target.value)}
            style={{
              width: "100%", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14, padding: "14px 18px", color: "#fff", outline: "none", fontSize: 14,
              transition: "all 0.2s",
            }}
            onFocus={e => e.target.style.borderColor = "#3b82f6"}
            onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
          />
        </div>
      </div>

      {loading ? <div style={{ color: "rgba(255,255,255,0.3)", padding: 40 }}>Syncing spatial intelligence...</div> : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {filteredData.length === 0 ? (
            <div style={{ padding: 60, border: "2px dashed rgba(255,255,255,0.05)", borderRadius: 24, color: "rgba(160,175,210,0.3)", fontSize: 13, fontFamily: "'IBM Plex Mono',monospace", gridColumn: "1 / -1", textAlign: "center", animation: "fadeUp 0.6s ease both" }}>
              <div style={{ fontSize: 24, marginBottom: 12, opacity: 0.5 }}>📍</div>
              NO ACTIVE RISKS DETECTED IN THIS AREA.<br/>SYSTEM STATUS: SECURE.
            </div>
          ) : filteredData.map((c, i) => (
            <div key={c.id} style={{ 
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", 
              borderRadius: 16, padding: 20, animation: "fadeUp 0.5s ease both" 
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 9, color: "#ff6b6b", fontWeight: 700, letterSpacing: "1px", marginBottom: 6, opacity: 0.8 }}>⚠️ RISK ALERT</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#eef2ff", textTransform: "capitalize" }}>{c.issue_type} Hazard</div>
                </div>
                <StatusBadge status={c.status} />
              </div>
              <div style={{ color: "rgba(160,175,210,0.5)", fontSize: 13, display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 12 }}>📍</span> {c.location || "Unspecified Area"}
              </div>
              <div style={{ height: 1, background: "rgba(255,255,255,0.05)", marginBottom: 12 }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 10, color: "rgba(160,175,210,0.3)", fontFamily: "'IBM Plex Mono',monospace" }}>{getAge(c.timestamp).label}</div>
                <div style={{ fontSize: 10, color: "#60a5fa", fontWeight: 600 }}>MONITORED BY {c.department}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function getAge(date) {
  const ms = Date.now() - date.getTime();
  const mins = Math.floor(ms / 60000);
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(ms / 86400000);
  if (days >= 1) return { label: `${days}d ago` };
  if (hours >= 1) return { label: `${hours}h ago` };
  return { label: `${mins}m ago` };
}
