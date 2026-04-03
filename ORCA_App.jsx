import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { saveComplaint, getAllComplaints } from "./firestore.js";


// ─── DATA ───────────────────────────────────────────────────────────────────
const RISK_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

// Mock data removed in favor of live API integration

// ─── RISK CONFIG ─────────────────────────────────────────────────────────────
const RISK_CONFIG = {
  CRITICAL: {
    label: "CRITICAL",
    color: "#ff4d4d",
    glow: "rgba(255,77,77,0.35)",
    glowSoft: "rgba(255,77,77,0.12)",
    border: "rgba(255,77,77,0.4)",
    bg: "rgba(255,77,77,0.08)",
    text: "#ff8080",
    bar: "linear-gradient(90deg,#ff4d4d,#ff8080)",
    dot: "#ff4d4d",
  },
  HIGH: {
    label: "HIGH",
    color: "#ff8c42",
    glow: "rgba(255,140,66,0.28)",
    glowSoft: "rgba(255,140,66,0.1)",
    border: "rgba(255,140,66,0.35)",
    bg: "rgba(255,140,66,0.07)",
    text: "#ffb07a",
    bar: "linear-gradient(90deg,#ff8c42,#ffb07a)",
    dot: "#ff8c42",
  },
  MEDIUM: {
    label: "MEDIUM",
    color: "#f5c542",
    glow: "rgba(245,197,66,0.2)",
    glowSoft: "rgba(245,197,66,0.07)",
    border: "rgba(245,197,66,0.25)",
    bg: "rgba(245,197,66,0.06)",
    text: "#f5d87a",
    bar: "linear-gradient(90deg,#f5c542,#f5d87a)",
    dot: "#f5c542",
  },
  LOW: {
    label: "LOW",
    color: "#3ecf8e",
    glow: "rgba(62,207,142,0.18)",
    glowSoft: "rgba(62,207,142,0.07)",
    border: "rgba(62,207,142,0.25)",
    bg: "rgba(62,207,142,0.06)",
    text: "#6edfa8",
    bar: "linear-gradient(90deg,#3ecf8e,#6edfa8)",
    dot: "#3ecf8e",
  },
};

// ─── ANIMATED NUMBER ─────────────────────────────────────────────────────────
function AnimatedNumber({ value, decimals = 0, duration = 1000 }) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef();
  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const to = value;
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * ease);
      if (p < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value]);
  return <>{display.toFixed(decimals)}</>;
}

// ─── CIRCULAR GAUGE ───────────────────────────────────────────────────────────
function CircularGauge({ value, max = 10, color, size = 72 }) {
  const r = 28;
  const circ = 2 * Math.PI * r;
  const pct = value / max;
  const [animated, setAnimated] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setAnimated(pct), 80);
    return () => clearTimeout(t);
  }, [pct]);
  return (
    <svg width={size} height={size} viewBox="0 0 64 64">
      <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
      <circle
        cx="32" cy="32" r={r} fill="none"
        stroke={color} strokeWidth="4"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - animated)}
        strokeLinecap="round"
        style={{ transition: "stroke-dashoffset 1.1s cubic-bezier(0.34,1.56,0.64,1)", transform: "rotate(-90deg)", transformOrigin: "center" }}
      />
      <text x="32" y="37" textAnchor="middle" fill={color} fontSize="13" fontWeight="700" fontFamily="'IBM Plex Mono',monospace">
        {value.toFixed(1)}
      </text>
    </svg>
  );
}

// ─── SHIMMER SKELETON ────────────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)",
      border: "1px solid rgba(255,255,255,0.06)",
      borderRadius: 20,
      padding: 24,
      overflow: "hidden",
      position: "relative",
    }}>
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .shim::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent);
          animation: shimmer 1.4s infinite;
        }
      `}</style>
      {[["60%","18px"], ["40%","12px"], ["100%","12px"], ["100%","12px"], ["80%","12px"]].map(([w,h],i) => (
        <div key={i} className="shim" style={{ position:"relative", width:w, height:h, background:"rgba(255,255,255,0.05)", borderRadius:8, marginBottom: i===0?16:8, overflow:"hidden" }} />
      ))}
    </div>
  );
}

// ─── ISSUE CARD ───────────────────────────────────────────────────────────────
function IssueCard({ issue, index }) {
  const cfg = RISK_CONFIG[issue.risk];
  const [hovered, setHovered] = useState(false);
  const isCrit = issue.risk === "CRITICAL";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        background: hovered
          ? `linear-gradient(135deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.025) 100%)`
          : `linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)`,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: `1px solid ${hovered ? cfg.border : "rgba(255,255,255,0.08)"}`,
        borderRadius: 20,
        padding: "24px 26px",
        transition: "all 0.3s cubic-bezier(0.34,1.3,0.64,1)",
        transform: hovered ? "translateY(-3px) scale(1.005)" : "translateY(0) scale(1)",
        boxShadow: hovered
          ? `0 20px 60px ${cfg.glow}, 0 0 0 1px ${cfg.border}`
          : isCrit
          ? `0 8px 30px ${cfg.glowSoft}, 0 0 40px ${cfg.glowSoft}`
          : `0 4px 20px rgba(0,0,0,0.3)`,
        animationDelay: `${index * 0.08}s`,
        animation: "cardIn 0.5s cubic-bezier(0.34,1.2,0.64,1) both",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes cardIn { from { opacity:0; transform: translateY(24px) scale(0.97); } to { opacity:1; transform: translateY(0) scale(1); } }
        @keyframes critPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      {/* Left accent bar */}
      <div style={{
        position: "absolute", left: 0, top: "15%", bottom: "15%", width: 3,
        borderRadius: "0 3px 3px 0",
        background: cfg.bar,
        boxShadow: `0 0 12px ${cfg.color}`,
      }} />

      {/* Card header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div style={{ flex: 1, paddingLeft: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            {isCrit && (
              <div style={{
                width: 7, height: 7, borderRadius: "50%",
                background: cfg.color,
                boxShadow: `0 0 8px ${cfg.color}`,
                animation: "critPulse 1.5s ease-in-out infinite",
              }} />
            )}
            <span style={{
              fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", letterSpacing: "1.5px",
              textTransform: "uppercase", color: cfg.text,
              background: cfg.bg, border: `1px solid ${cfg.border}`,
              padding: "3px 10px", borderRadius: 100,
            }}>{cfg.label}</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#eef2ff", letterSpacing: "-0.3px", lineHeight: 1.25, marginBottom: 4 }}>
            {issue.title}
          </div>
          <div style={{ fontSize: 12, color: "rgba(160,175,210,0.7)", fontFamily: "'IBM Plex Mono',monospace", display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ color: "rgba(255,255,255,0.2)" }}>⌖</span>
            {issue.location}
          </div>
        </div>

        {/* Dept badge */}
        <div style={{
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 10, padding: "8px 12px", textAlign: "right", flexShrink: 0, marginLeft: 16,
        }}>
          <div style={{ fontSize: 9, color: "rgba(160,175,210,0.5)", letterSpacing: "1.2px", marginBottom: 3, fontFamily: "'IBM Plex Mono',monospace", textTransform: "uppercase" }}>Dept</div>
          <div style={{ fontSize: 11, color: "rgba(200,210,240,0.8)", fontWeight: 600, whiteSpace: "nowrap" }}>{issue.department || "Unknown Department"}</div>
        </div>
      </div>

      {issue.email_sent !== undefined && (
        <div style={{ marginLeft: 10, marginBottom: 12, fontSize: 11, fontFamily: "'IBM Plex Mono',monospace", color: issue.email_sent ? "#3ecf8e" : "#ff4d4d", display: "flex", gap: 6, alignItems: "center" }}>
          <span>●</span>
          Email Status: {issue.email_sent ? "Sent ✅" : "Failed ❌"}
        </div>
      )}

      {/* Gauges row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18, paddingLeft: 10 }}>
        {[
          { label: "Human Impact", value: issue.humanImpact },
          { label: "Escalation Risk", value: issue.escalation },
        ].map(({ label, value }) => (
          <div key={label} style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 14, padding: "14px 16px",
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <CircularGauge value={value} color={cfg.color} />
            <div>
              <div style={{ fontSize: 10, color: "rgba(160,175,210,0.5)", textTransform: "uppercase", letterSpacing: "1px", marginBottom: 4, fontFamily: "'IBM Plex Mono',monospace" }}>{label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: cfg.text, fontFamily: "'IBM Plex Mono',monospace", lineHeight: 1 }}>
                <AnimatedNumber value={value} decimals={1} />
                <span style={{ fontSize: 12, color: "rgba(160,175,210,0.4)", fontWeight: 400 }}>/10</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Info chips */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 18, paddingLeft: 10 }}>
        {[
          { label: "Affected", value: `~${issue.affected.toLocaleString()}`, sub: "people" },
          { label: "Escalates In", value: issue.timeline, sub: "projected" },
          { label: "Confidence", value: `${issue.confidence}%`, sub: "AI score" },
        ].map(({ label, value, sub }) => (
          <div key={label} style={{
            background: "rgba(255,255,255,0.025)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 12, padding: "12px 14px",
          }}>
            <div style={{ fontSize: 9, color: "rgba(160,175,210,0.45)", letterSpacing: "1.2px", textTransform: "uppercase", marginBottom: 5, fontFamily: "'IBM Plex Mono',monospace" }}>{label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "rgba(230,238,255,0.9)", marginBottom: 2 }}>{value}</div>
            <div style={{ fontSize: 10, color: "rgba(160,175,210,0.4)" }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Timeline bar */}
      <div style={{ paddingLeft: 10, marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
          <span style={{ fontSize: 10, color: "rgba(160,175,210,0.45)", fontFamily: "'IBM Plex Mono',monospace", letterSpacing: "1px", textTransform: "uppercase" }}>Escalation Timeline</span>
          <span style={{ fontSize: 10, color: cfg.text, fontFamily: "'IBM Plex Mono',monospace" }}>{issue.timelinePercent}% urgency</span>
        </div>
        <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 10, overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${issue.timelinePercent}%`,
            background: cfg.bar,
            borderRadius: 10,
            boxShadow: `0 0 10px ${cfg.color}`,
            transition: "width 1.2s cubic-bezier(0.34,1.2,0.64,1)",
          }} />
        </div>
      </div>

      {/* Predictions */}
      <div style={{ paddingLeft: 10, marginBottom: 18 }}>
        <div style={{ fontSize: 10, color: "rgba(160,175,210,0.45)", letterSpacing: "1.2px", textTransform: "uppercase", marginBottom: 10, fontFamily: "'IBM Plex Mono',monospace" }}>AI Predictions</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {issue.predictions.map((p, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "rgba(180,192,225,0.75)", lineHeight: 1.45 }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: cfg.color, opacity: 0.7, marginTop: 5, flexShrink: 0, boxShadow: `0 0 6px ${cfg.color}` }} />
              {p}
            </div>
          ))}
        </div>
      </div>

      {/* Action box */}
      <div style={{
        marginLeft: 10,
        background: `linear-gradient(135deg, rgba(96,165,250,0.07), rgba(99,102,241,0.05))`,
        border: "1px solid rgba(96,165,250,0.2)",
        borderRadius: 12, padding: "14px 16px",
      }}>
        <div style={{ fontSize: 10, color: "#60a5fa", letterSpacing: "1.2px", textTransform: "uppercase", marginBottom: 6, fontFamily: "'IBM Plex Mono',monospace" }}>▲ Recommended Action</div>
        <div style={{ fontSize: 13, color: "rgba(147,197,253,0.9)", lineHeight: 1.5, fontWeight: 500 }}>{issue.action}</div>
      </div>

      {/* Confidence footer */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16, paddingLeft: 10, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <span style={{ fontSize: 9, color: "rgba(160,175,210,0.4)", letterSpacing: "1.2px", textTransform: "uppercase", fontFamily: "'IBM Plex Mono',monospace", flexShrink: 0 }}>Model Confidence</span>
        <div style={{ flex: 1, height: 3, background: "rgba(255,255,255,0.05)", borderRadius: 10, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${issue.confidence}%`,
            background: "linear-gradient(90deg,#3b82f6,#818cf8,#a78bfa)",
            borderRadius: 10,
            transition: "width 1.2s cubic-bezier(0.34,1.2,0.64,1)",
          }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "'IBM Plex Mono',monospace", color: "#818cf8" }}>{issue.confidence}%</span>
      </div>
    </div>
  );
}

// ─── PRIORITY ITEM ────────────────────────────────────────────────────────────
function PriorityItem({ issue, rank, animDelay }) {
  const cfg = RISK_CONFIG[issue.risk];
  const [hovered, setHovered] = useState(false);
  const isCrit = issue.risk === "CRITICAL";
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 16,
        background: hovered ? "rgba(255,255,255,0.045)" : "rgba(255,255,255,0.025)",
        backdropFilter: "blur(12px)",
        border: `1px solid ${hovered ? cfg.border : "rgba(255,255,255,0.07)"}`,
        borderRadius: 14, padding: "13px 18px",
        transition: "all 0.25s cubic-bezier(0.34,1.2,0.64,1)",
        transform: hovered ? "translateX(4px)" : "translateX(0)",
        boxShadow: hovered ? `0 8px 30px ${cfg.glow}` : isCrit ? `0 4px 20px ${cfg.glowSoft}` : "none",
        cursor: "default",
        animation: `slideIn 0.45s cubic-bezier(0.34,1.2,0.64,1) ${animDelay}s both`,
      }}
    >
      <style>{`@keyframes slideIn { from { opacity:0; transform:translateX(-16px); } to { opacity:1; transform:translateX(0); } }`}</style>
      <div style={{ fontFamily: "'IBM Plex Mono',monospace", fontSize: 11, color: "rgba(160,175,210,0.35)", minWidth: 28, textAlign: "right" }}>#{rank}</div>
      {isCrit && (
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color, boxShadow: `0 0 10px ${cfg.color}`, flexShrink: 0, animation: "critPulse 1.5s ease-in-out infinite" }} />
      )}
      <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: "rgba(220,230,255,0.9)" }}>{issue.title}</div>
      <div style={{ fontSize: 11, color: "rgba(160,175,210,0.45)", fontFamily: "'IBM Plex Mono',monospace", marginRight: 8 }}>{issue.timeline}</div>
      <span style={{
        fontSize: 9, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase",
        fontFamily: "'IBM Plex Mono',monospace",
        padding: "4px 11px", borderRadius: 100,
        background: cfg.bg, color: cfg.text, border: `1px solid ${cfg.border}`,
      }}>{cfg.label}</span>
    </div>
  );
}

// ─── STAT CHIP ────────────────────────────────────────────────────────────────
function StatChip({ label, value, color, sub }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.03)", backdropFilter: "blur(12px)",
      border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14,
      padding: "14px 18px", minWidth: 0,
    }}>
      <div style={{ fontSize: 9, color: "rgba(160,175,210,0.4)", letterSpacing: "1.5px", textTransform: "uppercase", fontFamily: "'IBM Plex Mono',monospace", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: color || "rgba(230,238,255,0.9)", marginBottom: 2, letterSpacing: "-0.5px" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "rgba(160,175,210,0.35)" }}>{sub}</div>}
    </div>
  );
}

// ─── NAV COMPONENT ────────────────────────────────────────────────────────────
function AppNav({ loc }) {
  const NAV = [
    { to: "/",        label: "Dashboard",   icon: "◈" },
    { to: "/history", label: "History",     icon: "⊞" },
    { to: "/pending", label: "Pending",     icon: "◉" },
    { to: "/location-risks", label: "Location Risks", icon: "📍" },
    { to: "/admin",   label: "Admin Portal", icon: "🛡️" },
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      {NAV.map(({ to, label, icon }) => {
        const active = loc.pathname === to;
        return (
          <Link key={to} to={to} style={{ textDecoration: "none" }}>
            <div
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "8px 16px", borderRadius: 10,
                background: active ? "rgba(59,130,246,0.15)" : "transparent",
                border: `1px solid ${active ? "rgba(59,130,246,0.3)" : "transparent"}`,
                color: active ? "#93c5fd" : "rgba(160,175,210,0.5)",
                fontSize: 13, fontWeight: active ? 600 : 400,
                transition: "all 0.2s", cursor: "pointer",
              }}
              onMouseEnter={e => { if (!active) { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = "rgba(210,220,255,0.8)"; }}}
              onMouseLeave={e => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(160,175,210,0.5)"; }}}
            >
              <span style={{ fontSize: 10 }}>{icon}</span>
              {label}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App({ user }) {
  const [issues, setIssues] = useState([]);
  const [inputVal, setInputVal] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [processingStep, setProcessingStep] = useState("");
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const shellRef = useRef(null);
  const fileInputRef = useRef(null);

  // Subtle parallax
  useEffect(() => {
    const handle = (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 20;
      const y = (e.clientY / window.innerHeight - 0.5) * 20;
      setMousePos({ x, y });
    };
    window.addEventListener("mousemove", handle, { passive: true });
    return () => window.removeEventListener("mousemove", handle);
  }, []);

  const [analysis, setAnalysis] = useState(null);
  const [history, setHistory] = useState([]);
  const loc = useLocation();

  // Load global complaint history count on mount (for nav badge)
  useEffect(() => {
    getAllComplaints().then(setHistory);
  }, []);

  const sorted = [...issues].sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk]);
  const critCount = issues.filter((i) => i.risk === "CRITICAL").length;
  const highCount = issues.filter((i) => i.risk === "HIGH").length;
  const totalAffected = issues.reduce((s, i) => s + i.affected, 0);

  const analyzeIssue = async () => {
    const trimmed = inputVal.trim();
    if (!trimmed) {
      alert("Please provide a description of the issue.");
      return;
    }
    if (loading) return;

    try {
      setLoading(true);
      
      const steps = [
        "Analyzing uploaded image...",
        "Detecting environmental hazards...",
        "Identifying specific issue type...",
        "Synthesizing visual + text data...",
        "Finalizing impact report..."
      ];

      for (let i = 0; i < steps.length; i++) {
        setProcessingStep(steps[i]);
        await new Promise(r => setTimeout(r, selectedImage ? 800 : 400));
      }

      const cId = `CIV-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

      const response = await fetch("https://operational-risk-control-agent-orca.onrender.com/api/process-complaint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: trimmed,
          location: "Inferred",
          complaint_id: cId
        })
      });

      const data = await response.json();
      
      // Map API response to Issue object format
      const newIssue = {
        id: Date.now(),
        title: data.issue_type || "General Issue",
        location: "Verified Local area",
        risk: data.risk_level === "high" ? "HIGH" : data.risk_level === "medium" ? "MEDIUM" : data.risk_level === "low" ? "LOW" : (data.risk_level || "MEDIUM").toUpperCase(),
        humanImpact: data.humanImpact || 5.0,
        escalation: data.escalation || 5.0,
        predictions: data.predictions || ["Analyzing potential risks...", "Department notified."],
        affected: data.affected || 1000,
        timeline: data.timeline || "2-4 days",
        timelinePercent: data.risk_level === "high" ? 85 : 45,
        action: data.action || "Assign to relevant department.",
        confidence: data.confidence || 85,
        department: data.department || "Unknown Department",
        email_sent: data.email_sent
      };

      setIssues((prev) => [newIssue, ...prev]);

      // ── FIRESTORE: Save complaint (email_content stored privately) ──
      if (user?.uid) {
        await saveComplaint(user.uid, {
          description: trimmed,
          location: "Inferred",
          issue_type: data.issue_type,
          department: data.department,
          risk_level: data.risk_level,
          complaint_id: data.complaint_id || cId,
          user_email: user.email,
          email_content: data.email_body || "",  // stored but never shown
        });
        // Refresh global history list
        getAllComplaints().then(setHistory);
      }

      const confidence = selectedImage ? 99.8 : (data.confidence || 96);
      setAnalysis({ ...data, complaint_id: data.complaint_id || cId, confidence });
      setInputVal("");
      setSelectedImage(null);
      setProcessingStep("");

    } catch (error) {
      console.error("FULL ERROR:", error);
      alert("Neural sync error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) analyzeIssue();
  };

  return (
    <div ref={shellRef} style={{ minHeight: "100vh", background: "#070b14", fontFamily: "'Inter', sans-serif", position: "relative", overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 4px; }
        @keyframes critPulse { 0%,100%{opacity:1;box-shadow:0 0 8px var(--c)} 50%{opacity:0.4;box-shadow:0 0 4px var(--c)} }
        @keyframes bgFloat { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-20px,20px)} }
        @keyframes bgFloat2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(20px,-15px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse2 { 0%,100%{opacity:1} 50%{opacity:0.5} }
        textarea:focus { outline: none; }
        textarea { resize: none; }
        button:active { transform: scale(0.97) !important; }
      `}</style>

      {/* ── BACKGROUND MESH ── */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0 }}>
        {/* Gradient orbs */}
        <div style={{
          position: "absolute", top: "-15%", left: "-10%",
          width: 700, height: 700, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)",
          animation: "bgFloat 18s ease-in-out infinite",
          transform: `translate(${mousePos.x * 0.3}px, ${mousePos.y * 0.3}px)`,
          transition: "transform 0.8s ease-out",
        }} />
        <div style={{
          position: "absolute", bottom: "-20%", right: "-10%",
          width: 800, height: 800, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)",
          animation: "bgFloat2 22s ease-in-out infinite",
          transform: `translate(${-mousePos.x * 0.2}px, ${-mousePos.y * 0.2}px)`,
          transition: "transform 0.8s ease-out",
        }} />
        <div style={{
          position: "absolute", top: "40%", left: "30%",
          width: 500, height: 400, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(168,85,247,0.06) 0%, transparent 70%)",
          animation: "bgFloat 26s ease-in-out infinite reverse",
        }} />
        {/* Grid lines */}
        <div style={{
          position: "absolute", inset: 0, opacity: 0.018,
          backgroundImage: "linear-gradient(rgba(99,130,250,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(99,130,250,0.5) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }} />
        {/* Vignette */}
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(ellipse at center, transparent 40%, rgba(4,6,15,0.7) 100%)",
        }} />
        {/* Noise texture via SVG filter — subtle grain */}
        <svg style={{ position: "absolute", width: 0, height: 0 }}>
          <filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch" /><feColorMatrix type="saturate" values="0" /></filter>
        </svg>
        <div style={{ position: "absolute", inset: 0, filter: "url(#noise)", opacity: 0.025 }} />
      </div>

      {/* ── SHELL ── */}
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
            {/* Logo mark */}
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: "linear-gradient(135deg, #1d4ed8 0%, #3b82f6 50%, #818cf8 100%)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 24px rgba(59,130,246,0.4)",
              fontFamily: "'IBM Plex Mono',monospace", fontSize: 13, fontWeight: 500, color: "#fff", letterSpacing: "-0.5px",
            }}>OR</div>
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontSize: 20, fontWeight: 800, color: "#eef2ff", letterSpacing: "-0.5px" }}>ORCA</span>
                <span style={{ fontSize: 12, color: "rgba(160,175,210,0.4)", fontFamily: "'IBM Plex Mono',monospace" }}>v2.1.0</span>
              </div>
              <div style={{ fontSize: 11, color: "rgba(160,175,210,0.45)", letterSpacing: "1.2px", textTransform: "uppercase", fontFamily: "'IBM Plex Mono',monospace" }}>Operational Risk Control Agent</div>
            </div>
          </div>

          {/* ── NAV ── */}
          <AppNav loc={loc} />

          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>

            {/* Active risk zones */}
            {critCount > 0 && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "rgba(255,77,77,0.08)", border: "1px solid rgba(255,77,77,0.25)",
                borderRadius: 100, padding: "7px 14px", fontSize: 12, fontWeight: 500, color: "#ff8080",
              }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#ff4d4d", boxShadow: "0 0 8px #ff4d4d", animation: "pulse2 1.5s infinite" }} />
                {critCount} Critical Zone{critCount > 1 ? "s" : ""}
              </div>
            )}

            {/* System active */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "rgba(62,207,142,0.07)", border: "1px solid rgba(62,207,142,0.2)",
              borderRadius: 100, padding: "7px 14px", fontSize: 12, fontWeight: 500, color: "#6edfa8",
            }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#3ecf8e", boxShadow: "0 0 8px #3ecf8e", animation: "pulse2 2s infinite" }} />
              System Active
            </div>

            {/* ── USER PROFILE ── */}
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
                <span style={{ fontSize: 10, color: "rgba(160,175,210,0.4)", fontFamily: "'IBM Plex Mono',monospace", letterSpacing: "0.5px" }}>Global Access Active</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── PRIORITY HERO ── */}
        <div style={{ marginBottom: 36, animation: "fadeUp 0.6s ease both" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <div style={{ width: 3, height: 16, background: "linear-gradient(180deg,#3b82f6,#818cf8)", borderRadius: 4 }} />
            <span style={{ fontSize: 10, letterSpacing: "2.5px", textTransform: "uppercase", color: "rgba(160,175,210,0.5)", fontFamily: "'IBM Plex Mono',monospace" }}>Live Priority Ranking</span>
            {issues.length > 0 && (
              <div style={{
                fontSize: 10, fontFamily: "'IBM Plex Mono',monospace", color: "rgba(160,175,210,0.4)",
                background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 100, padding: "2px 10px",
              }}>{issues.length} issue{issues.length !== 1 ? "s" : ""} tracked</div>
            )}
          </div>
          {issues.length === 0 ? (
            <div style={{
              background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.07)",
              borderRadius: 14, padding: "20px 24px", fontSize: 13, color: "rgba(160,175,210,0.3)",
              fontFamily: "'IBM Plex Mono',monospace",
            }}>— No issues logged yet. Add one below to begin risk analysis.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {sorted.map((issue, i) => (
                <PriorityItem key={issue.id} issue={issue} rank={i + 1} animDelay={i * 0.06} />
              ))}
            </div>
          )}
        </div>

        {/* ── STAT ROW ── */}
        {issues.length > 0 && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 20,
            marginBottom: 36,
            animation: "fadeUp 0.5s ease 0.1s both"
          }}>
            <StatChip label="Total Issues" value={issues.length} sub="tracked" />
            <StatChip label="Critical Alerts" value={critCount} color={critCount > 0 ? "#ff8080" : undefined} sub="require immediate action" />
            <StatChip label="High Risk" value={highCount} color={highCount > 0 ? "#ffb07a" : undefined} sub="escalation imminent" />
            <StatChip label="People Affected" value={totalAffected.toLocaleString()} color="#818cf8" sub="estimated total" />
          </div>
        )}

        {/* ── MAIN GRID ── */}
        <div style={{ display: "grid", gridTemplateColumns: "340px 1fr", gap: 24, alignItems: "start" }}>

          {/* ── INPUT PANEL ── */}
          <div style={{
            background: "rgba(255,255,255,0.03)", backdropFilter: "blur(20px)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 20, padding: 24,
            position: "sticky", top: 80,
            animation: "fadeUp 0.5s ease 0.15s both",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 18 }}>
              <div style={{ width: 3, height: 14, background: "linear-gradient(180deg,#3b82f6,#818cf8)", borderRadius: 4 }} />
              <span style={{ fontSize: 9, letterSpacing: "2px", textTransform: "uppercase", color: "rgba(160,175,210,0.4)", fontFamily: "'IBM Plex Mono',monospace" }}>Issue Intelligence Input</span>
            </div>

            {/* Simulated Image Preview */}
            {selectedImage && (
              <div style={{ position: "relative", marginBottom: 16, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(59,130,246,0.3)", boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}>
                <img src={selectedImage} alt="Preview" style={{ width: "100%", height: 180, objectFit: "cover" }} />
                <button 
                  onClick={() => setSelectedImage(null)}
                  style={{ position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: "50%", background: "rgba(0,0,0,0.6)", color: "#fff", border: "none", cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)" }}
                >✕</button>
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "6px 12px", background: "rgba(7,11,20,0.8)", backdropFilter: "blur(4px)", fontSize: 9, color: "#93c5fd", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", fontFamily: "'IBM Plex Mono',monospace" }}>
                  Visual Confirmation Active
                </div>
              </div>
            )}

            <textarea
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKey}
              placeholder={"Describe an urban issue…\n\n(e.g. water leakage near hospital, garbage overflow near school)"}
              style={{
                width: "100%", minHeight: 120,
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 12, color: "rgba(220,230,255,0.85)",
                fontFamily: "'Inter',sans-serif", fontSize: 14, lineHeight: 1.6,
                padding: "14px 16px",
                transition: "border-color 0.2s, box-shadow 0.2s",
                boxShadow: inputVal ? "0 0 0 1px rgba(59,130,246,0.3), 0 0 20px rgba(59,130,246,0.08)" : "none",
              }}
              onFocus={e => { e.target.style.borderColor = "rgba(59,130,246,0.45)"; e.target.style.boxShadow = "0 0 0 1px rgba(59,130,246,0.2), 0 0 24px rgba(59,130,246,0.1)"; }}
              onBlur={e => { e.target.style.borderColor = "rgba(255,255,255,0.09)"; e.target.style.boxShadow = "none"; }}
            />

            <input 
              type="file" 
              ref={fileInputRef} 
              accept="image/*" 
              capture="environment" 
              style={{ display: "none" }} 
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => setSelectedImage(ev.target.result);
                  reader.readAsDataURL(file);
                }
              }}
            />

            <button
              onClick={() => fileInputRef.current.click()}
              style={{
                width: "100%", marginTop: 12, padding: "10px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: 12, color: "rgba(160,175,210,0.6)",
                fontFamily: "'Inter',sans-serif", fontSize: 11, fontWeight: 600,
                cursor: "pointer", transition: "all 0.2s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(59,130,246,0.1)"; e.currentTarget.style.color = "#93c5fd"; e.currentTarget.style.borderColor = "rgba(59,130,246,0.3)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.color = "rgba(160,175,210,0.6)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.07)"; }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              {selectedImage ? "Change Reference Image" : "Attach Issue Photo (Optional)"}
            </button>

            <button
              onClick={analyzeIssue}
              disabled={loading || !inputVal.trim()}
              style={{
                width: "100%", marginTop: 8, padding: "13px",
                background: loading || !inputVal.trim()
                  ? "rgba(59,130,246,0.15)"
                  : "linear-gradient(135deg, #1d4ed8, #3b82f6)",
                border: "1px solid rgba(59,130,246,0.3)",
                borderRadius: 12, color: loading || !inputVal.trim() ? "rgba(147,197,253,0.4)" : "#fff",
                fontFamily: "'Inter',sans-serif", fontSize: 14, fontWeight: 700,
                cursor: loading || !inputVal.trim() ? "not-allowed" : "pointer",
                transition: "all 0.25s",
                boxShadow: !loading && inputVal.trim() ? "0 0 24px rgba(59,130,246,0.35)" : "none",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                letterSpacing: "0.3px",
              }}
              onMouseEnter={e => { if (!loading && inputVal.trim()) e.currentTarget.style.boxShadow = "0 0 36px rgba(59,130,246,0.5)"; }}
              onMouseLeave={e => { if (!loading && inputVal.trim()) e.currentTarget.style.boxShadow = "0 0 24px rgba(59,130,246,0.35)"; }}
            >
              {loading ? (
                <>
                  <div style={{ width: 14, height: 14, border: "2px solid rgba(147,197,253,0.3)", borderTopColor: "#93c5fd", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                  <div style={{ display: 'flex', flexDirection: 'column', fontSize: 10, gap: 1, textAlign: 'left', fontFamily: "'IBM Plex Mono',monospace" }}>
                    <span style={{ color: '#fff', opacity: 1 }}>{processingStep}</span>
                    <span style={{ opacity: 0.4 }}>Autonomous processing...</span>
                  </div>
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
                  Analyze &amp; Add Issue
                </>
              )}
            </button>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

            <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "20px 0" }} />
            <div style={{ fontSize: 10, color: "rgba(160,175,210,0.35)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 12, fontFamily: "'IBM Plex Mono',monospace" }}>Quick Examples</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {[
                "Garbage overflow near school",
                "Water leakage near hospital",
                "Broken streetlight on highway",
                "Stray animals near marketplace",
                "Sewage overflow near residential block",
                "Pothole on main road",
              ].map((t) => (
                <button
                  key={t}
                  onClick={() => setInputVal(t)}
                  style={{
                    padding: "6px 13px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 100, fontSize: 12,
                    fontFamily: "'Inter',sans-serif",
                    color: "rgba(160,175,210,0.6)",
                    cursor: "pointer",
                    transition: "all 0.2s",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(59,130,246,0.35)"; e.currentTarget.style.color = "rgba(220,230,255,0.85)"; e.currentTarget.style.background = "rgba(59,130,246,0.07)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(160,175,210,0.6)"; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Cmd hint */}
            <div style={{ marginTop: 18, fontSize: 11, color: "rgba(160,175,210,0.25)", fontFamily: "'IBM Plex Mono',monospace", textAlign: "center" }}>
              ⌘ + Enter to analyze
            </div>
          </div>

          {/* ── CARDS AREA ── */}
          <div>
            {loading && <SkeletonCard />}

            {!loading && issues.length === 0 && (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                padding: "80px 40px", color: "rgba(160,175,210,0.25)", textAlign: "center",
                border: "1px dashed rgba(255,255,255,0.05)", borderRadius: 20,
                background: "rgba(255,255,255,0.01)",
              }}>
                <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.2 }}>◈</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "rgba(160,175,210,0.3)", marginBottom: 8 }}>No risk assessments yet</div>
                <div style={{ fontSize: 13, color: "rgba(160,175,210,0.2)" }}>Add an issue to begin AI-powered analysis</div>
              </div>
            )}

            {!loading && issues.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {sorted.map((issue, i) => (
                  <IssueCard key={issue.id} issue={issue} index={i} />
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
