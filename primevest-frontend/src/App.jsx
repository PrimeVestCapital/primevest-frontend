import { useState, useEffect, useRef, useCallback } from "react";

// ─── Brand Colors ────────────────────────────────────────
// Navy: #1a2e4a  Gold: #b8933f  Light Gold: #d4a853

// ─── API Configuration ───────────────────────────────────
// In dev: Vite proxies /api → http://localhost:5000/api (see vite.config.js)
// In prod: set VITE_API_URL in your .env file
const BASE_URL = import.meta.env?.VITE_API_URL || "/api";

// ─── Token Storage ────────────────────────────────────────
const TOKEN_KEY = "pv_access_token";
const REFRESH_KEY = "pv_refresh_token";

const tokenStore = {
  getAccess: () => localStorage.getItem(TOKEN_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  set: (access, refresh) => {
    if (access) localStorage.setItem(TOKEN_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

// ─── API Fetch Wrapper ────────────────────────────────────
let isRefreshing = false;
let refreshQueue = [];

async function apiFetch(endpoint, options = {}, retry = true) {
  const url = `${BASE_URL}${endpoint}`;
  const accessToken = tokenStore.getAccess();

  const config = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
  };

  if (options.body && typeof options.body === "object") {
    config.body = JSON.stringify(options.body);
  }

  let response;
  try {
    response = await fetch(url, config);
  } catch {
    throw new Error("Network error. Please check your connection and ensure the server is running.");
  }

  if (response.status === 401 && retry) {
    const data = await response.json().catch(() => ({}));
    if (data.code === "TOKEN_EXPIRED") {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then(() => apiFetch(endpoint, options, false));
      }
      isRefreshing = true;
      const refreshToken = tokenStore.getRefresh();
      if (!refreshToken) {
        tokenStore.clear();
        throw new Error("SESSION_EXPIRED");
      }
      try {
        const res = await fetch(`${BASE_URL}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken }),
        });
        const rd = await res.json();
        if (!res.ok || !rd.success) {
          tokenStore.clear();
          refreshQueue.forEach(({ reject }) => reject(new Error("SESSION_EXPIRED")));
          refreshQueue = [];
          throw new Error("SESSION_EXPIRED");
        }
        tokenStore.set(rd.data.accessToken, rd.data.refreshToken);
        refreshQueue.forEach(({ resolve }) => resolve());
        refreshQueue = [];
        return apiFetch(endpoint, options, false);
      } catch (err) {
        throw err;
      } finally {
        isRefreshing = false;
      }
    }
    throw new Error(data.message || "Authentication required.");
  }

  const responseData = await response.json().catch(() => ({ success: false, message: "Invalid server response." }));
  if (!response.ok) {
    const err = new Error(responseData.message || `Request failed: ${response.status}`);
    err.statusCode = response.status;
    err.code = responseData.code;
    throw err;
  }
  return responseData;
}

// ─── Utility ─────────────────────────────────────────────
const fmt = (n) =>
  Number(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (ts) => {
  if (!ts) return "—";

  const d = new Date(ts);

  if (isNaN(d.getTime())) return "—";

  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

// ─── Toast Component ──────────────────────────────────────
function EmailToast({ toasts, onClose }) {
  return (
    <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, display: "flex", flexDirection: "column", gap: 10, maxWidth: 340, pointerEvents: "none" }}>
      {toasts.map((t) => (
        <div key={t.id} style={{
          background: t.type === "success" ? "#0f2d1a" : t.type === "error" ? "#2d0f0f" : "#1a1f2e",
          border: `1px solid ${t.type === "success" ? "#2ecc71" : t.type === "error" ? "#e74c3c" : "#b8933f"}`,
          borderRadius: 10, padding: "14px 18px", color: "#fff", fontSize: 13,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)", animation: "slideIn 0.3s ease",
          display: "flex", alignItems: "flex-start", gap: 12, pointerEvents: "all"
        }}>
          <span style={{ fontSize: 20, marginTop: -2 }}>
            {t.type === "success" ? "✅" : t.type === "error" ? "❌" : "📧"}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, marginBottom: 3, color: t.type === "success" ? "#2ecc71" : t.type === "error" ? "#e74c3c" : "#d4a853" }}>{t.title}</div>
            <div style={{ opacity: 0.85, lineHeight: 1.4 }}>{t.message}</div>
          </div>
          <button onClick={() => onClose(t.id)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", fontSize: 16, padding: 0 }}>×</button>
        </div>
      ))}
    </div>
  );
}

// ─── Logo Component ───────────────────────────────────────
function Logo({ size = "md" }) {
  const sizes = { sm: { text: 16, sub: 9 }, md: { text: 22, sub: 11 }, lg: { text: 30, sub: 14 } };
  const s = sizes[size];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: s.text * 2, height: s.text * 2, borderRadius: "50%", background: "linear-gradient(135deg, #1a2e4a, #b8933f)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: s.text * 0.7 }}>PV</div>
      <div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: s.text, color: "#1a2e4a", letterSpacing: "-0.5px", lineHeight: 1 }}>
          <span>Prime</span><span style={{ color: "#b8933f" }}>Vest</span>
        </div>
        <div style={{ fontFamily: "'Montserrat', sans-serif", fontWeight: 600, fontSize: s.sub, color: "#1a2e4a", letterSpacing: 3, textTransform: "uppercase", opacity: 0.7 }}>Capital</div>
      </div>
    </div>
  );
}

// ─── PIN Modal Component ──────────────────────────────────
function PinModal({ onConfirm, onCancel, amount, loading }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState("");
  const inputs = useRef([]);

  const handleKey = (i, val) => {
    if (!/^\d?$/.test(val)) return;
    const arr = pin.split("");
    arr[i] = val;
    const newPin = arr.join("").slice(0, 4);
    setPin(newPin);
    setErr("");
    if (val && i < 3) inputs.current[i + 1]?.focus();
  };
  const handleBackspace = (i, e) => {
    if (e.key === "Backspace" && !pin[i] && i > 0) inputs.current[i - 1]?.focus();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: "40px 36px", maxWidth: 360, width: "100%", textAlign: "center", boxShadow: "0 24px 80px rgba(0,0,0,0.3)" }}>
        <div style={{ width: 60, height: 60, borderRadius: "50%", background: "#fff8ec", border: "2px solid #b8933f", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", fontSize: 24 }}>🔐</div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#1a2e4a", marginBottom: 8 }}>Confirm Withdrawal</div>
        <div style={{ color: "#666", fontSize: 14, marginBottom: 8 }}>Withdrawing <strong style={{ color: "#1a2e4a" }}>${fmt(amount)}</strong></div>
        <div style={{ color: "#888", fontSize: 13, marginBottom: 24 }}>Enter your 4-digit security PIN</div>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 20 }}>
          {[0, 1, 2, 3].map(i => (
            <input key={i} ref={el => inputs.current[i] = el}
              type="password" inputMode="numeric" maxLength={1}
              value={pin[i] || ""}
              onChange={e => handleKey(i, e.target.value)}
              onKeyDown={e => handleBackspace(i, e)}
              style={{
                width: 52, height: 56, textAlign: "center", fontSize: 22, fontWeight: 700,
                border: `2px solid ${err ? "#e74c3c" : pin[i] ? "#b8933f" : "#ddd"}`,
                borderRadius: 10, outline: "none", color: "#1a2e4a", transition: "border-color 0.2s"
              }} />
          ))}
        </div>
        {err && <div style={{ color: "#e74c3c", fontSize: 13, marginBottom: 12 }}>{err}</div>}
        <button
          onClick={() => { if (pin.length === 4) onConfirm(pin); else setErr("Please enter all 4 digits"); }}
          disabled={loading}
          style={{ width: "100%", padding: "14px", background: loading ? "#ccc" : "linear-gradient(135deg, #1a2e4a, #2a4a70)", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer", marginBottom: 10 }}>
          {loading ? "Processing..." : "Confirm Withdrawal"}
        </button>
        <button onClick={onCancel} disabled={loading} style={{ width: "100%", padding: "12px", background: "transparent", color: "#888", border: "1px solid #ddd", borderRadius: 10, fontSize: 14, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Loading Spinner ──────────────────────────────────────
function Spinner({ size = 24, color = "#b8933f" }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{
        width: size, height: size, border: `3px solid ${color}20`, borderTop: `3px solid ${color}`,
        borderRadius: "50%", animation: "spin 0.8s linear infinite"
      }} />
    </div>
  );
}

// ════════════════════════════════════════════════════════
// AUTH PAGE
// ════════════════════════════════════════════════════════
function AuthPage({ onLogin, toast }) {
  const [tab, setTab] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", pin: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleLogin = async () => {
    setErr("");
    if (!form.email || !form.password) { setErr("Email and password required."); return; }
    setLoading(true);
    try {
      const res = await apiFetch("/api/auth/login", { method: "POST", body: { email: form.email, password: form.password } });
      tokenStore.set(res.data.accessToken, res.data.refreshToken);
      onLogin(res.data.user);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setErr("");
    if (!form.name || !form.email || !form.password || !form.pin) { setErr("All fields required."); return; }
    if (!/^\d{4}$/.test(form.pin)) { setErr("PIN must be 4 digits."); return; }
    if (form.password.length < 8) { setErr("Password must be at least 8 characters."); return; }
    if (form.password !== form.confirm) { setErr("Passwords do not match."); return; }
    setLoading(true);
    try {
      const res = await apiFetch("/api/auth/register", { method: "POST", body: { name: form.name, email: form.email, password: form.password, pin: form.pin } });
      tokenStore.set(res.data.accessToken, res.data.refreshToken);
      toast("✅ Welcome!", `Account created for ${res.data.user.email}`, "success");
      onLogin(res.data.user);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { width: "100%", padding: "14px 16px", border: "1.5px solid #e0e0e0", borderRadius: 10, fontSize: 15, outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0d1e33, #1a2e4a)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: "40px 36px", maxWidth: 420, width: "100%", boxShadow: "0 24px 80px rgba(0,0,0,0.3)" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}><Logo size="lg" /></div>
        <div style={{ display: "flex", gap: 10, marginBottom: 28 }}>
          <button onClick={() => { setTab("login"); setErr(""); }} style={{ flex: 1, padding: "12px", background: tab === "login" ? "linear-gradient(135deg, #1a2e4a, #2a4a70)" : "#f5f5f5", color: tab === "login" ? "#fff" : "#888", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Sign In</button>
          <button onClick={() => { setTab("register"); setErr(""); }} style={{ flex: 1, padding: "12px", background: tab === "register" ? "linear-gradient(135deg, #1a2e4a, #2a4a70)" : "#f5f5f5", color: tab === "register" ? "#fff" : "#888", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Register</button>
        </div>

        {tab === "login" ? (
          <>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Email</label>
              <input type="email" placeholder="you@example.com" value={form.email} onChange={e => set("email", e.target.value)} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Password</label>
              <input type="password" placeholder="••••••••" value={form.password} onChange={e => set("password", e.target.value)} onKeyDown={e => e.key === "Enter" && handleLogin()} style={inputStyle} />
            </div>
            {err && <div style={{ color: "#e74c3c", fontSize: 13, marginBottom: 16, textAlign: "center" }}>{err}</div>}
            <button onClick={handleLogin} disabled={loading} style={{ width: "100%", padding: "15px", background: loading ? "#ccc" : "linear-gradient(135deg, #1a2e4a, #2a4a70)", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer", marginBottom: 12 }}>
              {loading ? "Signing In..." : "Sign In"}
            </button>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Full Name</label>
              <input placeholder="John Doe" value={form.name} onChange={e => set("name", e.target.value)} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Email</label>
              <input type="email" placeholder="you@example.com" value={form.email} onChange={e => set("email", e.target.value)} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Password</label>
              <input type="password" placeholder="Min. 8 characters" value={form.password} onChange={e => set("password", e.target.value)} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Confirm Password</label>
              <input type="password" placeholder="Retype password" value={form.confirm} onChange={e => set("confirm", e.target.value)} style={inputStyle} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Security PIN (4 digits)</label>
              <input type="password" inputMode="numeric" maxLength={4} placeholder="1234" value={form.pin} onChange={e => /^\d{0,4}$/.test(e.target.value) && set("pin", e.target.value)} style={inputStyle} />
            </div>
            {err && <div style={{ color: "#e74c3c", fontSize: 13, marginBottom: 16, textAlign: "center" }}>{err}</div>}
            <button onClick={handleRegister} disabled={loading} style={{ width: "100%", padding: "15px", background: loading ? "#ccc" : "linear-gradient(135deg, #b8933f, #d4a853)", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: loading ? "default" : "pointer" }}>
              {loading ? "Creating Account..." : "Create Account"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════
// USER DASHBOARD
// ════════════════════════════════════════════════════════
function UserDashboard({ user: initialUser, onLogout, toast }) {
  const [user, setUser] = useState(initialUser);
  const [tab, setTab] = useState("overview");
  const [showPin, setShowPin] = useState(false);
  const [withdrawAmt, setWithdrawAmt] = useState("");
  const [pendingWithdraw, setPendingWithdraw] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  
  // New withdrawal method states
  const [withdrawalStep, setWithdrawalStep] = useState(1); // 1: method, 2: details, 3: code
  const [withdrawalMethod, setWithdrawalMethod] = useState(""); // "bank" or "crypto"
  const [paymentDetails, setPaymentDetails] = useState({
    // Bank details
    accountName: "",
    bankName: "",
    accountNumber: "",
    // Crypto details
    walletAddress: ""
  });
  const [withdrawalCode, setWithdrawalCode] = useState("");

  // Support chat states
  const [showSupportChat, setShowSupportChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // Refresh user data from API
  const refreshUser = useCallback(async () => {
    try {
      setDataLoading(true);
      const res = await apiFetch("/users/me");
      setUser(res.data);
    } catch (e) {
      if (e.message === "SESSION_EXPIRED") onLogout();
    } finally {
      setDataLoading(false);
    }
  }, [onLogout]);

  // Load support messages
  const loadSupportMessages = useCallback(async () => {
    try {
      const res = await apiFetch("/users/support/messages");
      if (res.success) {
        setChatMessages(res.data || []);
      }
    } catch (e) {
      console.error("Failed to load support messages:", e);
    }
  }, []);

  useEffect(() => {
    refreshUser();
    loadSupportMessages();
  }, []);

  const totalPortfolio = (user.balance || 0) + (user.profit || 0);
  const profitPct = user.balance > 0 ? ((user.profit / user.balance) * 100).toFixed(2) : "0.00";

  const initiateWithdraw = () => {
    const amt = parseFloat(withdrawAmt);
    if (!amt || amt <= 0) { toast("Error", "Enter a valid amount.", "error"); return; }
    if (amt > totalPortfolio) { toast("Error", `Insufficient funds. Available: $${fmt(totalPortfolio)}`, "error"); return; }
    setPendingWithdraw(amt);
    setWithdrawalStep(1); // Start withdrawal flow
  };

  const proceedToDetails = () => {
    if (!withdrawalMethod) {
      toast("Error", "Please select a withdrawal method.", "error");
      return;
    }
    setWithdrawalStep(2);
  };

  const proceedToCode = () => {
    // Validate payment details
    if (withdrawalMethod === "bank") {
      if (!paymentDetails.accountName || !paymentDetails.bankName || !paymentDetails.accountNumber) {
        toast("Error", "Please fill in all bank details.", "error");
        return;
      }
    } else if (withdrawalMethod === "crypto") {
      if (!paymentDetails.walletAddress) {
        toast("Error", "Please enter your USDT wallet address.", "error");
        return;
      }
      // Basic validation for crypto address
      if (paymentDetails.walletAddress.length < 26) {
        toast("Error", "Please enter a valid USDT ERC20 wallet address.", "error");
        return;
      }
    }
    setWithdrawalStep(3);
  };

  const confirmWithdraw = async (pin) => {
    if (!withdrawalCode) {
      toast("Error", "Please enter your withdrawal code.", "error");
      return;
    }
    
    setWithdrawLoading(true);
    try {
      const res = await apiFetch("/api/users/withdraw", {
        method: "POST",
        body: { 
          amount: pendingWithdraw, 
          pin,
          withdrawalMethod,
          paymentDetails: withdrawalMethod === "bank" ? {
            accountName: paymentDetails.accountName,
            bankName: paymentDetails.bankName,
            accountNumber: paymentDetails.accountNumber
          } : {
            walletAddress: paymentDetails.walletAddress,
            network: "ERC20"
          },
          withdrawalCode
        },
      });
      
      // Update local state
      setUser(prev => ({
        ...prev,
        balance: res.data.newBalance,
        profit: res.data.newProfit,
        transactions: [res.data.transaction, ...(prev.transactions || [])],
      }));
      
      toast("✅ Withdrawal Successful", `$${fmt(pendingWithdraw)} has been processed. Funds will arrive in 1–3 business days.`, "success");
      toast("📧 Email Sent", `Withdrawal confirmation sent to ${user.email}`, "email");
      
      // Reset states
      setShowPin(false);
      setPendingWithdraw(null);
      setWithdrawAmt("");
      setWithdrawalStep(1);
      setWithdrawalMethod("");
      setPaymentDetails({ accountName: "", bankName: "", accountNumber: "", walletAddress: "" });
      setWithdrawalCode("");
      setTab("overview");
    } catch (e) {
      if (e.code === "WRONG_PIN") {
        toast("Wrong PIN", "Incorrect security PIN. Please try again.", "error");
      } else if (e.code === "INVALID_WITHDRAWAL_CODE") {
        toast("Invalid Code", "The withdrawal code is incorrect. Please contact support.", "error");
      } else if (e.message === "SESSION_EXPIRED") {
        onLogout();
      } else {
        toast("Error", e.message, "error");
      }
      setShowPin(false);
      setPendingWithdraw(null);
    } finally {
      setWithdrawLoading(false);
    }
  };

  const cancelWithdrawal = () => {
    setShowPin(false);
    setPendingWithdraw(null);
    setWithdrawalStep(1);
    setWithdrawalMethod("");
    setPaymentDetails({ accountName: "", bankName: "", accountNumber: "", walletAddress: "" });
    setWithdrawalCode("");
  };

  const sendSupportMessage = async () => {
    if (!chatInput.trim()) return;
    
    const tempMessage = {
      id: Date.now(),
      message: chatInput,
      sender: "user",
      createdAt: new Date().toISOString(),
      isTemp: true
    };
    
    setChatMessages(prev => [...prev, tempMessage]);
    const messageToSend = chatInput;
    setChatInput("");
    setChatLoading(true);
    
    try {
      const res = await apiFetch("/api/users/support/send", {
        method: "POST",
        body: { message: messageToSend }
      });
      
      if (res.success) {
        // Remove temp message and add real one
        setChatMessages(prev => prev.filter(m => !m.isTemp).concat(res.data));
        toast("Message Sent", "Your message has been sent to support.", "success");
      }
    } catch (e) {
      toast("Error", "Failed to send message. Please try again.", "error");
      setChatMessages(prev => prev.filter(m => !m.isTemp));
    } finally {
      setChatLoading(false);
    }
  };

  const cardStyle = (gradient = false) => ({
    background: gradient ? "linear-gradient(135deg, #1a2e4a, #2a4a70)" : "#fff",
    borderRadius: 16,
    padding: "24px 28px",
    boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
    color: gradient ? "#fff" : "#1a2e4a"
  });

  const inputStyle = { 
    width: "100%", 
    padding: "14px 16px", 
    border: "1.5px solid #e0e0e0", 
    borderRadius: 10, 
    fontSize: 15, 
    outline: "none", 
    boxSizing: "border-box" 
  };

  const menuItems = [
    { id: "overview", icon: "📊", label: "Overview" },
    { id: "transactions", icon: "💳", label: "Transactions" },
    { id: "withdraw", icon: "💸", label: "Withdraw" },
    { id: "profile", icon: "⚙️", label: "Settings" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#f5f7fa" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0d1e33, #1a2e4a)", padding: "20px 24px", boxShadow: "0 2px 16px rgba(0,0,0,0.1)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Logo size="sm" />
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <button 
              onClick={() => setShowSupportChat(true)}
              style={{ 
                background: "rgba(255,255,255,0.1)", 
                border: "1px solid rgba(255,255,255,0.2)", 
                borderRadius: 8, 
                padding: "8px 16px", 
                color: "#fff", 
                cursor: "pointer", 
                fontSize: 13,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 6
              }}>
              💬 Support
            </button>
            <div style={{ position: "relative" }}>
              <button onClick={() => setMenuOpen(!menuOpen)} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "8px 16px", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                {user.name} ▾
              </button>
              {menuOpen && (
                <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, background: "#fff", borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.15)", minWidth: 180, overflow: "hidden", zIndex: 100 }}>
                  <button onClick={onLogout} style={{ width: "100%", padding: "12px 16px", background: "none", border: "none", textAlign: "left", cursor: "pointer", fontSize: 14, color: "#e74c3c", fontWeight: 600 }}>
                    🚪 Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
        {/* Navigation Tabs */}
        <div style={{ display: "flex", gap: 12, marginBottom: 32, overflowX: "auto" }}>
          {menuItems.map(item => (
            <button key={item.id} onClick={() => setTab(item.id)}
              style={{
                padding: "12px 20px", background: tab === item.id ? "#fff" : "transparent",
                border: tab === item.id ? "2px solid #b8933f" : "2px solid transparent", borderRadius: 12,
                fontSize: 14, fontWeight: 700, color: tab === item.id ? "#1a2e4a" : "#666",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
                boxShadow: tab === item.id ? "0 2px 8px rgba(0,0,0,0.08)" : "none"
              }}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {tab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>
            <div style={cardStyle(true)}>
              <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 6 }}>Total Portfolio</div>
              <div style={{ fontSize: 36, fontWeight: 800, fontFamily: "'Playfair Display', serif" }}>${fmt(totalPortfolio)}</div>
              <div style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>Balance: ${fmt(user.balance)} • Profit: ${fmt(user.profit)}</div>
            </div>
            <div style={cardStyle()}>
              <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>Investment Plan</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#b8933f" }}>{user.plan}</div>
              <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>Since {fmtDate(user.joinDate)}</div>
            </div>
            <div style={cardStyle()}>
              <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>Total Returns</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#27ae60" }}>+{profitPct}%</div>
              <div style={{ fontSize: 13, color: "#888", marginTop: 4 }}>${fmt(user.profit)} earned</div>
            </div>

            {/* Recent Transactions */}
            <div style={{ ...cardStyle(), gridColumn: "1 / -1" }}>
              <h3 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700 }}>Recent Activity</h3>
              {user.transactions?.slice(0, 5).map(tx => (
                <div key={tx.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0", borderBottom: "1px solid #f0f0f0" }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, textTransform: "capitalize", marginBottom: 2 }}>{tx.type}</div>
                    <div style={{ fontSize: 12, color: "#888" }}>{fmtDate(tx.date)}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: tx.type === "withdrawal" ? "#e74c3c" : "#27ae60" }}>
                    {tx.type === "withdrawal" ? "-" : "+"}${fmt(tx.amount)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TRANSACTIONS TAB */}
        {tab === "transactions" && (
          <div style={{ maxWidth: 800 }}>
            <h2 style={{ margin: "0 0 24px", fontSize: 22, fontWeight: 700, color: "#1a2e4a", fontFamily: "'Playfair Display', serif" }}>Transaction History</h2>
            <div style={cardStyle()}>
              {user.transactions?.map(tx => (
                <div key={tx.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 0", borderBottom: "1px solid #f0f0f0" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, textTransform: "capitalize" }}>{tx.type}</div>
                      <div style={{ padding: "2px 8px", background: "#f0f4f8", borderRadius: 6, fontSize: 11, fontWeight: 700, color: "#666" }}>{tx.status}</div>
                    </div>
                    <div style={{ fontSize: 12, color: "#888" }}>{fmtDate(tx.date)}</div>
                    {tx.note && <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>{tx.note}</div>}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: tx.type === "withdrawal" ? "#e74c3c" : "#27ae60" }}>
                    {tx.type === "withdrawal" ? "-" : "+"}${fmt(tx.amount)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* WITHDRAW TAB */}
        {tab === "withdraw" && (
          <div style={{ maxWidth: 480 }}>
            <h2 style={{ margin: "0 0 24px", fontSize: 22, fontWeight: 700, color: "#1a2e4a", fontFamily: "'Playfair Display', serif" }}>Withdraw Funds</h2>
            
            {!pendingWithdraw ? (
              <>
                <div style={{ ...cardStyle(true), marginBottom: 16, textAlign: "center" }}>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>Available Balance</div>
                  <div style={{ fontSize: 36, fontWeight: 800, fontFamily: "'Playfair Display', serif" }}>${fmt(totalPortfolio)}</div>
                </div>
                <div style={cardStyle()}>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Withdrawal Amount (USD)</label>
                    <input type="number" placeholder="0.00" value={withdrawAmt} onChange={e => setWithdrawAmt(e.target.value)}
                      style={{ width: "100%", padding: "14px 16px", border: "1.5px solid #e0e0e0", borderRadius: 10, fontSize: 18, fontWeight: 700, color: "#1a2e4a", outline: "none", boxSizing: "border-box" }} />
                  </div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
                    {[25, 50, 75, 100].map(pct => (
                      <button key={pct} onClick={() => setWithdrawAmt((totalPortfolio * pct / 100).toFixed(2))}
                        style={{ flex: 1, padding: "8px", background: "#f0f4f8", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#1a2e4a" }}>{pct}%</button>
                    ))}
                  </div>
                  <div style={{ background: "#fff8e1", border: "1px solid #ffe082", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#8a6d00" }}>
                    ⚠️ You will need to select a withdrawal method and provide a withdrawal code to complete this request.
                  </div>
                  <button onClick={initiateWithdraw}
                    style={{ width: "100%", padding: "15px", background: "linear-gradient(135deg, #b8933f, #d4a853)", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                    Continue →
                  </button>
                </div>
              </>
            ) : (
              <>
                {/* Step 1: Select Method */}
                {withdrawalStep === 1 && (
                  <div style={cardStyle()}>
                    <h3 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700 }}>Select Withdrawal Method</h3>
                    <div style={{ marginBottom: 16 }}>
                      <button 
                        onClick={() => setWithdrawalMethod("bank")}
                        style={{
                          width: "100%",
                          padding: "20px",
                          background: withdrawalMethod === "bank" ? "#f0f9ff" : "#fff",
                          border: withdrawalMethod === "bank" ? "2px solid #3b82f6" : "2px solid #e0e0e0",
                          borderRadius: 12,
                          cursor: "pointer",
                          marginBottom: 12,
                          textAlign: "left",
                          display: "flex",
                          alignItems: "center",
                          gap: 16
                        }}>
                        <div style={{ fontSize: 32 }}>🏦</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: "#1a2e4a", marginBottom: 4 }}>Bank Transfer</div>
                          <div style={{ fontSize: 13, color: "#666" }}>Withdraw to your bank account</div>
                        </div>
                        {withdrawalMethod === "bank" && <div style={{ fontSize: 20, color: "#3b82f6" }}>✓</div>}
                      </button>
                      
                      <button 
                        onClick={() => setWithdrawalMethod("crypto")}
                        style={{
                          width: "100%",
                          padding: "20px",
                          background: withdrawalMethod === "crypto" ? "#f0fdf4" : "#fff",
                          border: withdrawalMethod === "crypto" ? "2px solid #10b981" : "2px solid #e0e0e0",
                          borderRadius: 12,
                          cursor: "pointer",
                          textAlign: "left",
                          display: "flex",
                          alignItems: "center",
                          gap: 16
                        }}>
                        <div style={{ fontSize: 32 }}>₿</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 16, fontWeight: 700, color: "#1a2e4a", marginBottom: 4 }}>Crypto (USDT)</div>
                          <div style={{ fontSize: 13, color: "#666" }}>Withdraw to USDT wallet (ERC20)</div>
                        </div>
                        {withdrawalMethod === "crypto" && <div style={{ fontSize: 20, color: "#10b981" }}>✓</div>}
                      </button>
                    </div>
                    
                    <div style={{ display: "flex", gap: 12 }}>
                      <button onClick={cancelWithdrawal}
                        style={{ flex: 1, padding: "14px", background: "#f5f5f5", color: "#666", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                        Cancel
                      </button>
                      <button onClick={proceedToDetails}
                        style={{ flex: 1, padding: "14px", background: "linear-gradient(135deg, #1a2e4a, #2a4a70)", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                        Continue →
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 2: Enter Details */}
                {withdrawalStep === 2 && (
                  <div style={cardStyle()}>
                    <h3 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700 }}>
                      {withdrawalMethod === "bank" ? "Bank Account Details" : "Crypto Wallet Details"}
                    </h3>
                    
                    {withdrawalMethod === "bank" ? (
                      <>
                        <div style={{ marginBottom: 14 }}>
                          <label style={{ fontSize: 12, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Account Name</label>
                          <input 
                            placeholder="John Doe" 
                            value={paymentDetails.accountName} 
                            onChange={e => setPaymentDetails(p => ({ ...p, accountName: e.target.value }))} 
                            style={inputStyle} />
                        </div>
                        <div style={{ marginBottom: 14 }}>
                          <label style={{ fontSize: 12, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Bank Name</label>
                          <input 
                            placeholder="ABC Bank" 
                            value={paymentDetails.bankName} 
                            onChange={e => setPaymentDetails(p => ({ ...p, bankName: e.target.value }))} 
                            style={inputStyle} />
                        </div>
                        <div style={{ marginBottom: 20 }}>
                          <label style={{ fontSize: 12, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Account Number</label>
                          <input 
                            placeholder="1234567890" 
                            value={paymentDetails.accountNumber} 
                            onChange={e => setPaymentDetails(p => ({ ...p, accountNumber: e.target.value }))} 
                            style={inputStyle} />
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#166534" }}>
                          ℹ️ Only USDT (ERC20) network is supported. Ensure your wallet supports ERC20 tokens.
                        </div>
                        <div style={{ marginBottom: 20 }}>
                          <label style={{ fontSize: 12, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>USDT Wallet Address (ERC20)</label>
                          <input 
                            placeholder="0x..." 
                            value={paymentDetails.walletAddress} 
                            onChange={e => setPaymentDetails(p => ({ ...p, walletAddress: e.target.value }))} 
                            style={inputStyle} />
                        </div>
                      </>
                    )}
                    
                    <div style={{ display: "flex", gap: 12 }}>
                      <button onClick={() => setWithdrawalStep(1)}
                        style={{ flex: 1, padding: "14px", background: "#f5f5f5", color: "#666", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                        ← Back
                      </button>
                      <button onClick={proceedToCode}
                        style={{ flex: 1, padding: "14px", background: "linear-gradient(135deg, #1a2e4a, #2a4a70)", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                        Continue →
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3: Enter Code and PIN */}
                {withdrawalStep === 3 && (
                  <div style={cardStyle()}>
                    <h3 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700 }}>Verify Withdrawal</h3>
                    
                    <div style={{ background: "#fff8e1", border: "1px solid #ffe082", borderRadius: 10, padding: "16px", marginBottom: 20, fontSize: 13, color: "#8a6d00" }}>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>⚠️ Important:</div>
                      <div style={{ marginBottom: 4 }}>• A withdrawal code is required to process this transaction</div>
                      <div style={{ marginBottom: 4 }}>• If you don't have a code, please contact support</div>
                      <div>• After entering the code, you'll confirm with your security PIN</div>
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 13, color: "#666", marginBottom: 12 }}>Withdrawing ${fmt(pendingWithdraw)} to:</div>
                      {withdrawalMethod === "bank" ? (
                        <div style={{ background: "#f9fafb", borderRadius: 8, padding: "12px", fontSize: 13 }}>
                          <div><strong>Account:</strong> {paymentDetails.accountName}</div>
                          <div><strong>Bank:</strong> {paymentDetails.bankName}</div>
                          <div><strong>Number:</strong> {paymentDetails.accountNumber}</div>
                        </div>
                      ) : (
                        <div style={{ background: "#f9fafb", borderRadius: 8, padding: "12px", fontSize: 12, wordBreak: "break-all" }}>
                          <div><strong>USDT Wallet (ERC20):</strong></div>
                          <div style={{ marginTop: 4 }}>{paymentDetails.walletAddress}</div>
                        </div>
                      )}
                    </div>

                    <div style={{ marginBottom: 20 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Withdrawal Code</label>
                      <input 
                        type="text"
                        placeholder="Enter your withdrawal code" 
                        value={withdrawalCode} 
                        onChange={e => setWithdrawalCode(e.target.value)} 
                        style={inputStyle} />
                      <div style={{ fontSize: 11, color: "#888", marginTop: 6 }}>
                        Don't have a code? <button onClick={() => setShowSupportChat(true)} style={{ background: "none", border: "none", color: "#b8933f", cursor: "pointer", textDecoration: "underline", padding: 0, fontSize: 11 }}>Contact support</button>
                      </div>
                    </div>
                    
                    <div style={{ display: "flex", gap: 12 }}>
                      <button onClick={() => setWithdrawalStep(2)}
                        style={{ flex: 1, padding: "14px", background: "#f5f5f5", color: "#666", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                        ← Back
                      </button>
                      <button onClick={() => setShowPin(true)}
                        style={{ flex: 1, padding: "14px", background: "linear-gradient(135deg, #b8933f, #d4a853)", color: "#fff", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                        Confirm with PIN
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* PROFILE/SETTINGS TAB */}
        {tab === "profile" && (
          <div style={{ maxWidth: 600 }}>
            <h2 style={{ margin: "0 0 24px", fontSize: 22, fontWeight: 700, color: "#1a2e4a", fontFamily: "'Playfair Display', serif" }}>Account Settings</h2>
            <div style={cardStyle()}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Name</div>
                <div style={{ fontSize: 16, color: "#1a2e4a" }}>{user.name}</div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Email</div>
                <div style={{ fontSize: 16, color: "#1a2e4a" }}>{user.email}</div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Member Since</div>
                <div style={{ fontSize: 16, color: "#1a2e4a" }}>{fmtDate(user.joinDate)}</div>
              </div>
              <div style={{ padding: "16px", background: "#f9fafb", borderRadius: 10, fontSize: 13, color: "#666" }}>
                To update your profile or change your password/PIN, please contact support.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PIN Modal */}
      {showPin && (
        <PinModal
          amount={pendingWithdraw}
          loading={withdrawLoading}
          onConfirm={confirmWithdraw}
          onCancel={() => { setShowPin(false); }}
        />
      )}

      {/* Support Chat Modal */}
      {showSupportChat && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1001, display: "flex", alignItems: "flex-end", justifyContent: "flex-end", padding: 20 }}>
          <div style={{ 
            background: "#fff", 
            borderRadius: 16, 
            width: "100%", 
            maxWidth: 400, 
            height: "600px", 
            maxHeight: "80vh",
            boxShadow: "0 24px 80px rgba(0,0,0,0.3)",
            display: "flex",
            flexDirection: "column"
          }}>
            {/* Chat Header */}
            <div style={{ 
              background: "linear-gradient(135deg, #1a2e4a, #2a4a70)", 
              color: "#fff", 
              padding: "20px", 
              borderTopLeftRadius: 16, 
              borderTopRightRadius: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 2 }}>Customer Support</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>We typically reply within 24 hours</div>
              </div>
              <button onClick={() => setShowSupportChat(false)} style={{ 
                background: "rgba(255,255,255,0.2)", 
                border: "none", 
                color: "#fff", 
                cursor: "pointer", 
                fontSize: 20, 
                width: 32,
                height: 32,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}>×</button>
            </div>

            {/* Chat Messages */}
            <div style={{ 
              flex: 1, 
              overflowY: "auto", 
              padding: 20,
              background: "#f9fafb"
            }}>
              {chatMessages.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "#888" }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>💬</div>
                  <div style={{ fontSize: 14 }}>No messages yet.</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>Send a message to get help from our support team.</div>
                </div>
              ) : (
                chatMessages.map(msg => (
                  <div key={msg.id} style={{ 
                    marginBottom: 16,
                    display: "flex",
                    justifyContent: msg.sender === "user" ? "flex-end" : "flex-start"
                  }}>
                    <div style={{
                      maxWidth: "75%",
                      background: msg.sender === "user" ? "linear-gradient(135deg, #1a2e4a, #2a4a70)" : "#fff",
                      color: msg.sender === "user" ? "#fff" : "#1a2e4a",
                      padding: "12px 16px",
                      borderRadius: 12,
                      boxShadow: "0 2px 8px rgba(0,0,0,0.1)"
                    }}>
                      <div style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 4 }}>{msg.message}</div>
                      <div style={{ fontSize: 11, opacity: 0.7 }}>{fmtDate(msg.createdAt)}</div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Chat Input */}
            <div style={{ 
              padding: 16, 
              borderTop: "1px solid #e0e0e0",
              background: "#fff",
              borderBottomLeftRadius: 16,
              borderBottomRightRadius: 16
            }}>
              <div style={{ display: "flex", gap: 8 }}>
                <input 
                  type="text"
                  placeholder="Type your message..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendSupportMessage()}
                  disabled={chatLoading}
                  style={{
                    flex: 1,
                    padding: "12px",
                    border: "1.5px solid #e0e0e0",
                    borderRadius: 10,
                    fontSize: 14,
                    outline: "none"
                  }}
                />
                <button 
                  onClick={sendSupportMessage}
                  disabled={chatLoading || !chatInput.trim()}
                  style={{
                    padding: "12px 20px",
                    background: chatLoading || !chatInput.trim() ? "#ccc" : "linear-gradient(135deg, #b8933f, #d4a853)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 10,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: chatLoading || !chatInput.trim() ? "default" : "pointer"
                  }}>
                  {chatLoading ? "..." : "Send"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// ADMIN DASHBOARD
// ════════════════════════════════════════════════════════
function AdminDashboard({ onLogout, toast }) {
  const [tab, setTab] = useState("overview");
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [editForm, setEditForm] = useState({ balance: "", profit: "", plan: "Starter" });
  const [saveLoading, setSaveLoading] = useState(false);
  const [msgForm, setMsgForm] = useState({ userId: "all", subject: "", body: "" });
  const [notifyLoading, setNotifyLoading] = useState(false);
  const [supportMessages, setSupportMessages] = useState([]);
  const [selectedSupport, setSelectedSupport] = useState(null);
  const [supportReply, setSupportReply] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/admin/dashboard");
      setStats(res.data.stats);
    } catch (e) {
      toast("Error", e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadUsers = useCallback(async () => {
    try {
      const res = await apiFetch("/admin/users");
      setUsers(res.data);
    } catch (e) {
      toast("Error", e.message, "error");
    }
  }, [toast]);

  const loadSupportMessages = useCallback(async () => {
    try {
      const res = await apiFetch("/admin/support/messages");
      if (res.success) {
        setSupportMessages(res.data || []);
      }
    } catch (e) {
      console.error("Failed to load support messages:", e);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    loadUsers();
    loadSupportMessages();
  }, []);

  const openEdit = (u) => {
    setSelected(u.id);
    setEditForm({ balance: u.balance, profit: u.profit, plan: u.plan });
  };

  const saveEdit = async () => {
    setSaveLoading(true);
    try {
      await apiFetch(`/admin/users/${selected}/portfolio`, {
        method: "PUT",
        body: editForm,
      });
      toast("Success", "Portfolio updated and client notified.", "success");
      loadUsers();
      setSelected(null);
    } catch (e) {
      toast("Error", e.message, "error");
    } finally {
      setSaveLoading(false);
    }
  };

  const sendNotification = async () => {
    if (!msgForm.subject || !msgForm.body) {
      toast("Error", "Subject and message required.", "error");
      return;
    }
    setNotifyLoading(true);
    try {
      await apiFetch("/admin/notify", { method: "POST", body: msgForm });
      toast("Email Sent", `Notification sent to ${msgForm.userId === "all" ? "all clients" : "client"}`, "success");
      setMsgForm({ userId: "all", subject: "", body: "" });
    } catch (e) {
      toast("Error", e.message, "error");
    } finally {
      setNotifyLoading(false);
    }
  };

  const sendSupportReply = async () => {
    if (!supportReply.trim() || !selectedSupport) return;
    
    setReplyLoading(true);
    try {
      const res = await apiFetch("/admin/support/reply", {
        method: "POST",
        body: {
          messageId: selectedSupport.id,
          reply: supportReply
        }
      });
      
      if (res.success) {
        toast("Reply Sent", "Your reply has been sent to the user.", "success");
        setSupportReply("");
        setSelectedSupport(null);
        loadSupportMessages();
      }
    } catch (e) {
      toast("Error", "Failed to send reply.", "error");
    } finally {
      setReplyLoading(false);
    }
  };

  const cardStyle = (gradient = false) => ({
    background: gradient ? "linear-gradient(135deg, #1a2e4a, #2a4a70)" : "#fff",
    borderRadius: 16,
    padding: "24px 28px",
    boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
    color: gradient ? "#fff" : "#1a2e4a"
  });

  const inputStyle = { 
    width: "100%", 
    padding: "14px 16px", 
    border: "1.5px solid #e0e0e0", 
    borderRadius: 10, 
    fontSize: 15, 
    outline: "none", 
    boxSizing: "border-box" 
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f5f7fa" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0d1e33, #1a2e4a)", padding: "20px 24px", boxShadow: "0 2px 16px rgba(0,0,0,0.1)" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Logo size="sm" />
            <div style={{ color: "#b8933f", fontSize: 13, fontWeight: 700, padding: "4px 12px", background: "rgba(184,147,63,0.15)", borderRadius: 6 }}>ADMIN</div>
          </div>
          <button onClick={onLogout} style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 8, padding: "8px 16px", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            🚪 Sign Out
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
        {/* Navigation */}
        <div style={{ display: "flex", gap: 12, marginBottom: 32, overflowX: "auto" }}>
          {[
            { id: "overview", icon: "📊", label: "Overview" },
            { id: "users", icon: "👥", label: "Clients" },
            { id: "portfolio", icon: "💼", label: "Update Portfolio" },
            { id: "notify", icon: "📧", label: "Send Email" },
            { id: "support", icon: "💬", label: "Support Messages" },
          ].map(item => (
            <button key={item.id} onClick={() => setTab(item.id)}
              style={{
                padding: "12px 20px", background: tab === item.id ? "#fff" : "transparent",
                border: tab === item.id ? "2px solid #b8933f" : "2px solid transparent", borderRadius: 12,
                fontSize: 14, fontWeight: 700, color: tab === item.id ? "#1a2e4a" : "#666",
                cursor: "pointer", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap",
                boxShadow: tab === item.id ? "0 2px 8px rgba(0,0,0,0.08)" : "none"
              }}>
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* OVERVIEW TAB */}
        {tab === "overview" && stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
            <div style={cardStyle(true)}>
              <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 6 }}>Total Clients</div>
              <div style={{ fontSize: 40, fontWeight: 800, fontFamily: "'Playfair Display', serif" }}>{stats.totalClients}</div>
            </div>
            <div style={cardStyle()}>
              <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>Total AUM</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: "#b8933f" }}>${fmt(stats.totalAUM)}</div>
            </div>
            <div style={cardStyle()}>
              <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>Client Balances</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: "#3b82f6" }}>${fmt(stats.totalBalance)}</div>
            </div>
            <div style={cardStyle()}>
              <div style={{ fontSize: 13, color: "#666", marginBottom: 6 }}>Total Profits</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: "#27ae60" }}>${fmt(stats.totalProfit)}</div>
            </div>
          </div>
        )}

        {/* USERS TAB */}
        {tab === "users" && (
          <div>
            <h3 style={{ margin: "0 0 20px", color: "#1a2e4a", fontFamily: "'Playfair Display', serif" }}>All Clients</h3>
            <div style={cardStyle()}>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: "2px solid #f0f0f0" }}>
                      <th style={{ padding: "12px 8px", textAlign: "left", fontWeight: 700, color: "#666", fontSize: 12, textTransform: "uppercase" }}>Name</th>
                      <th style={{ padding: "12px 8px", textAlign: "left", fontWeight: 700, color: "#666", fontSize: 12, textTransform: "uppercase" }}>Email</th>
                      <th style={{ padding: "12px 8px", textAlign: "left", fontWeight: 700, color: "#666", fontSize: 12, textTransform: "uppercase" }}>Plan</th>
                      <th style={{ padding: "12px 8px", textAlign: "right", fontWeight: 700, color: "#666", fontSize: 12, textTransform: "uppercase" }}>Balance</th>
                      <th style={{ padding: "12px 8px", textAlign: "right", fontWeight: 700, color: "#666", fontSize: 12, textTransform: "uppercase" }}>Profit</th>
                      <th style={{ padding: "12px 8px", textAlign: "right", fontWeight: 700, color: "#666", fontSize: 12, textTransform: "uppercase" }}>Portfolio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                        <td style={{ padding: "14px 8px", fontWeight: 600 }}>{u.name}</td>
                        <td style={{ padding: "14px 8px", color: "#666" }}>{u.email}</td>
                        <td style={{ padding: "14px 8px" }}><span style={{ padding: "4px 10px", background: "#f0f4f8", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>{u.plan}</span></td>
                        <td style={{ padding: "14px 8px", textAlign: "right", fontWeight: 600 }}>${fmt(u.balance)}</td>
                        <td style={{ padding: "14px 8px", textAlign: "right", fontWeight: 600, color: "#27ae60" }}>${fmt(u.profit)}</td>
                        <td style={{ padding: "14px 8px", textAlign: "right", fontWeight: 700, color: "#1a2e4a" }}>${fmt(u.portfolio)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PORTFOLIO UPDATE TAB */}
        {tab === "portfolio" && (
          <div style={{ maxWidth: 560 }}>
            <h3 style={{ margin: "0 0 20px", color: "#1a2e4a", fontFamily: "'Playfair Display', serif" }}>Update Client Portfolio</h3>
            <div style={{ background: "#fff", borderRadius: 16, padding: "28px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)", marginBottom: 16 }}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Select Client</label>
                <select value={selected || ""} onChange={e => { const u = users.find(x => x.id === e.target.value); if (u) openEdit(u); }}
                  style={{ ...inputStyle, appearance: "none" }}>
                  <option value="">-- Choose a client --</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                </select>
              </div>
              {selected && (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Balance (USD)</label>
                      <input type="number" value={editForm.balance} onChange={e => setEditForm(p => ({ ...p, balance: e.target.value }))} style={inputStyle} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Profit (USD)</label>
                      <input type="number" value={editForm.profit} onChange={e => setEditForm(p => ({ ...p, profit: e.target.value }))} style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ fontSize: 12, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Investment Plan</label>
                    <select value={editForm.plan} onChange={e => setEditForm(p => ({ ...p, plan: e.target.value }))} style={{ ...inputStyle, appearance: "none" }}>
                      {["Starter", "Growth", "Premium", "Platinum"].map(p => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div style={{ background: "#f0f4ff", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#3a5a9a" }}>
                    📧 An email notification will be sent to the client automatically upon saving.
                  </div>
                  <button onClick={saveEdit} disabled={saveLoading}
                    style={{ width: "100%", padding: "14px", background: saveLoading ? "#ccc" : "linear-gradient(135deg, #1a2e4a, #2a4a70)", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: saveLoading ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                    {saveLoading ? <><Spinner size={18} color="#fff" /> Saving...</> : "Save Changes & Notify Client"}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* NOTIFY TAB */}
        {tab === "notify" && (
          <div style={{ maxWidth: 560 }}>
            <h3 style={{ margin: "0 0 20px", color: "#1a2e4a", fontFamily: "'Playfair Display', serif" }}>Send Email Notification</h3>
            <div style={{ background: "#fff", borderRadius: 16, padding: "28px", boxShadow: "0 2px 16px rgba(0,0,0,0.06)" }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Recipient</label>
                <select value={msgForm.userId} onChange={e => setMsgForm(p => ({ ...p, userId: e.target.value }))} style={{ ...inputStyle, appearance: "none" }}>
                  <option value="all">📢 All Clients</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Subject</label>
                <input placeholder="Email subject..." value={msgForm.subject} onChange={e => setMsgForm(p => ({ ...p, subject: e.target.value }))} style={inputStyle} />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Message</label>
                <textarea placeholder="Write your message here..." value={msgForm.body} onChange={e => setMsgForm(p => ({ ...p, body: e.target.value }))}
                  style={{ ...inputStyle, height: 120, resize: "vertical" }} />
              </div>
              <button onClick={sendNotification} disabled={notifyLoading}
                style={{ width: "100%", padding: "14px", background: notifyLoading ? "#ccc" : "linear-gradient(135deg, #b8933f, #d4a853)", color: "#fff", border: "none", borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: notifyLoading ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
                {notifyLoading ? <><Spinner size={18} color="#fff" /> Sending...</> : "📧 Send Notification"}
              </button>
            </div>
          </div>
        )}

        {/* SUPPORT MESSAGES TAB */}
        {tab === "support" && (
          <div style={{ maxWidth: 800 }}>
            <h3 style={{ margin: "0 0 20px", color: "#1a2e4a", fontFamily: "'Playfair Display', serif" }}>Support Messages</h3>
            <div style={cardStyle()}>
              {supportMessages.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "#888" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>💬</div>
                  <div style={{ fontSize: 16 }}>No support messages yet</div>
                </div>
              ) : (
                supportMessages.map(msg => (
                  <div key={msg.id} style={{ 
                    padding: "16px", 
                    marginBottom: 12, 
                    background: msg.adminReply ? "#f9fafb" : "#fff8e1", 
                    borderRadius: 10,
                    border: msg.adminReply ? "1px solid #e0e0e0" : "1px solid #ffe082"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 2 }}>{msg.userName}</div>
                        <div style={{ fontSize: 12, color: "#888" }}>{msg.userEmail}</div>
                      </div>
                      <div style={{ fontSize: 11, color: "#888" }}>{fmtDate(msg.createdAt)}</div>
                    </div>
                    <div style={{ fontSize: 14, color: "#1a2e4a", marginBottom: msg.adminReply ? 12 : 0 }}>{msg.message}</div>
                    {msg.adminReply && (
                      <div style={{ 
                        marginTop: 12, 
                        paddingTop: 12, 
                        borderTop: "1px solid #e0e0e0",
                        fontSize: 13,
                        color: "#666"
                      }}>
                        <div style={{ fontWeight: 700, marginBottom: 4, color: "#b8933f" }}>Your Reply:</div>
                        {msg.adminReply}
                      </div>
                    )}
                    {!msg.adminReply && (
                      <button 
                        onClick={() => setSelectedSupport(msg)}
                        style={{
                          marginTop: 12,
                          padding: "8px 16px",
                          background: "linear-gradient(135deg, #1a2e4a, #2a4a70)",
                          color: "#fff",
                          border: "none",
                          borderRadius: 8,
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer"
                        }}>
                        Reply
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Support Reply Modal */}
      {selectedSupport && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: "32px", maxWidth: 500, width: "100%", boxShadow: "0 24px 80px rgba(0,0,0,0.3)" }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 700, color: "#1a2e4a" }}>Reply to {selectedSupport.userName}</h3>
            
            <div style={{ background: "#f9fafb", borderRadius: 10, padding: "16px", marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>User's Message:</div>
              <div style={{ fontSize: 14, color: "#1a2e4a" }}>{selectedSupport.message}</div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 8 }}>Your Reply</label>
              <textarea 
                placeholder="Type your reply here..."
                value={supportReply}
                onChange={e => setSupportReply(e.target.value)}
                style={{ ...inputStyle, height: 120, resize: "vertical" }}
              />
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button 
                onClick={() => { setSelectedSupport(null); setSupportReply(""); }}
                disabled={replyLoading}
                style={{ 
                  flex: 1, 
                  padding: "14px", 
                  background: "#f5f5f5", 
                  color: "#666", 
                  border: "none", 
                  borderRadius: 10, 
                  fontSize: 14, 
                  fontWeight: 700, 
                  cursor: "pointer" 
                }}>
                Cancel
              </button>
              <button 
                onClick={sendSupportReply}
                disabled={replyLoading || !supportReply.trim()}
                style={{ 
                  flex: 1, 
                  padding: "14px", 
                  background: replyLoading || !supportReply.trim() ? "#ccc" : "linear-gradient(135deg, #b8933f, #d4a853)", 
                  color: "#fff", 
                  border: "none", 
                  borderRadius: 10, 
                  fontSize: 14, 
                  fontWeight: 700, 
                  cursor: replyLoading || !supportReply.trim() ? "default" : "pointer" 
                }}>
                {replyLoading ? "Sending..." : "Send Reply"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════
// ROOT APP
// ════════════════════════════════════════════════════════
export default function App() {
  const [session, setSession] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [bootstrapping, setBootstrapping] = useState(true);

  const toast = useCallback((title, message, type = "email") => {
    const id = Math.random().toString(36).slice(2);
    setToasts(p => [...p, { id, title, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 5000);
  }, []);

  const removeToast = useCallback((id) => setToasts(p => p.filter(t => t.id !== id)), []);

  // Auto-restore session on mount
  useEffect(() => {
    const tryRestore = async () => {
      const accessToken = tokenStore.getAccess();
      if (!accessToken) { setBootstrapping(false); return; }
      try {
        const res = await apiFetch("/api/users/me");
        setSession(res.data);
      } catch (e) {
        if (e.message !== "SESSION_EXPIRED") {
          // Try admin check
          try {
            const adminRes = await apiFetch("/api/admin/dashboard");
            if (adminRes.success) setSession({ role: "admin" });
          } catch {
            tokenStore.clear();
          }
        } else {
          tokenStore.clear();
        }
      } finally {
        setBootstrapping(false);
      }
    };
    tryRestore();
  }, []);

  const handleLogin = useCallback((userData) => {
    setSession(userData);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      const refreshToken = tokenStore.getRefresh();
      await apiFetch("/api/auth/logout", { method: "POST", body: { refreshToken } });
    } catch (_) {}
    tokenStore.clear();
    setSession(null);
  }, []);

  if (bootstrapping) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0d1e33, #1a2e4a)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg, #1a2e4a, #b8933f)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: 20 }}>PV</div>
        <Spinner size={32} color="#b8933f" />
        <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 13, fontFamily: "'Montserrat', sans-serif" }}>Loading PrimeVest Capital...</div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&family=Montserrat:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; -webkit-font-smoothing: antialiased; }
        body { margin: 0; font-family: 'Montserrat', sans-serif; }
        @keyframes slideIn { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input:focus, select:focus, textarea:focus { border-color: #b8933f !important; box-shadow: 0 0 0 3px rgba(184,147,63,0.1); }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: #f1f1f1; }
        ::-webkit-scrollbar-thumb { background: #c0c0c0; border-radius: 3px; }
      `}</style>

      <EmailToast toasts={toasts} onClose={removeToast} />

      {!session && <AuthPage onLogin={handleLogin} toast={toast} />}
      {session?.role === "admin" && <AdminDashboard onLogout={handleLogout} toast={toast} />}
      {session && session.role !== "admin" && (
        <UserDashboard user={session} onLogout={handleLogout} toast={toast} />
      )}
    </>
  );
}
