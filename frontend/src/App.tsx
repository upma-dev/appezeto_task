import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Link, Navigate, useLocation } from "react-router-dom";
import Dashboard from "./components/Dashboard.js";
import TicketList from "./components/TicketList.js";
import CreateTicket from "./components/CreateTicket.js";
import TicketDetail from "./components/TicketDetail.js";
import AuthSwitcher from "./components/AuthSwitcher.js";
import AdminPanel from "./components/AdminPanel.js";
import { LayoutDashboard, Ticket, FolderPlus, Key, LogOut, ShieldAlert, Cpu, RefreshCw } from "lucide-react";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: "admin" | "agent" | "customer";
  agentName?: string | null;
}

function NavigationHeader({ currentUser, onLogout }: { currentUser: UserProfile; onLogout: () => void }) {
  const location = useLocation();

  const navItems = [
    { label: "Dashboard Metrics", path: "/", icon: LayoutDashboard },
    { label: "Active Tickets", path: "/tickets", icon: Ticket },
    { label: "File Support Ticket", path: "/create-ticket", icon: FolderPlus }
  ];

  if (currentUser.role === "admin") {
    navItems.push({ label: "RBAC & Team Control", path: "/admin", icon: ShieldAlert });
  }

  return (
    <nav className="bg-white border-b border-gray-100 py-4 px-8 flex flex-col md:flex-row items-center justify-between gap-4 sticky top-0 z-30 shadow-xs">
      <div className="flex items-center gap-2.5">
        <div className="p-2.5 bg-indigo-600 text-white rounded-2xl shadow-md">
          <Cpu className="w-5 h-5" />
        </div>
        <div>
          <span className="font-black text-gray-800 text-lg leading-none tracking-tight block">APPZETO</span>
          <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block mt-0.5">Helpdesk Backplane</span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 bg-gray-100/60 p-1.5 rounded-2xl w-full md:w-auto overflow-x-auto justify-center">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                isActive
                  ? "bg-white text-indigo-600 shadow-sm border border-gray-200/50"
                  : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </div>

      <div className="flex items-center gap-4 text-xs font-semibold text-gray-500">
        <div className="text-right">
          <span className="text-gray-800 font-bold block">{currentUser.name}</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">{currentUser.role} view</span>
        </div>
        <button
          onClick={onLogout}
          className="p-2.5 bg-gray-50 hover:bg-rose-50 text-gray-400 hover:text-rose-600 border border-gray-200 hover:border-rose-100 rounded-2xl transition"
          title="Sign Out"
        >
          <LogOut className="w-4.5 h-4.5" />
        </button>
      </div>
    </nav>
  );
}

function WelcomeGuestLogin({ onLoginSuccess }: { onLoginSuccess: (token: string, user: UserProfile) => void }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("customer");
  const [agentName, setAgentName] = useState("Riya");
  const [customAgentName, setCustomAgentName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (isRegistering && !name) {
      setError("Please input a valid full name.");
      return;
    }
    if (!email || !password) {
      setError("Please input email and passcode attributes.");
      return;
    }

    setLoading(true);
    try {
      const endpoint = isRegistering ? "/api/auth/register" : "/api/auth/login";
      const payload: any = { email, password };

      if (isRegistering) {
        payload.name = name;
        payload.role = role;
        if (role === "agent") {
          payload.agentName = agentName === "other" ? (customAgentName || "Custom Agent") : agentName;
        }
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Authentication attempt failed.");
      }

      const data = await res.json();
      onLoginSuccess(data.token, data.user);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-12 px-6 flex flex-col space-y-8 animate-fade-in">
      <div className="text-center space-y-3">
        <div className="mx-auto w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg">
          <Cpu className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-black text-gray-800 tracking-tight">Appzeto Support Panel</h2>
        <p className="text-gray-400 text-sm">
          {isRegistering 
            ? "Create your unique profile in our system. Credentials save instantly to your persistent database."
            : "Welcome! Sign in using manual credentials to securely access your personal helpdesk dashboard."}
        </p>
      </div>

      <div className="bg-white p-8 rounded-3xl border-2 border-slate-200 shadow-md space-y-6">
        <div className="flex items-center justify-between border-b pb-4">
          <h3 className="font-extrabold text-gray-800 text-base flex items-center gap-2">
            <Key className="w-5 h-5 text-indigo-600" /> 
            {isRegistering ? "Register New Account" : "Account Authentication"}
          </h3>
          <span className="text-[10px] bg-slate-100 text-slate-700 font-bold px-2.5 py-1 rounded-full border">
            {isRegistering ? "Sign Up" : "Sign In"}
          </span>
        </div>

        {error && (
          <div className="bg-red-50 border-2 border-red-200 text-red-800 text-xs rounded-xl p-4 flex gap-2 items-start">
            <ShieldAlert className="w-4.5 h-4.5 text-red-500 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegistering && (
            <div className="space-y-1.5 animate-fade-in">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Full Name</label>
              <input
                type="text"
                value={name}
                required
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Somya Shekhar"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-xs bg-gray-50/50 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Email Address</label>
            <input
              type="email"
              value={email}
              required
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. somi@helpdesk.com"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-xs bg-gray-50/50 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Password</label>
            <input
              type="password"
              value={password}
              required
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-xs bg-gray-50/50 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
            />
          </div>

          {isRegistering && (
            <div className="space-y-4 pt-1 animate-fade-in">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">System Role (RBAC)</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-xs bg-gray-50/50 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-semibold text-gray-700 cursor-pointer"
                >
                  <option value="customer">Customer (Create Support Tickets)</option>
                  <option value="agent">Agent (Claim & Resolve Support Tickets)</option>
                  <option value="admin">Admin (Global SLA Override & RBAC Section)</option>
                </select>
              </div>

              {role === "agent" && (
                <div className="space-y-3 p-3 bg-indigo-50/50 border border-indigo-100 rounded-2xl animate-fade-in">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">Assign Agent Name Pool</label>
                    <select
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      className="w-full px-4 py-2 border border-indigo-200 bg-white rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 text-gray-700 font-semibold cursor-pointer"
                    >
                      <option value="Riya">Riya (Tier 1 Support)</option>
                      <option value="Karan">Karan (Tier 2 Technical)</option>
                      <option value="Dev">Dev (SRE Infrastructure)</option>
                      <option value="other">Other/Custom Agent Identity</option>
                    </select>
                  </div>

                  {agentName === "other" && (
                    <div className="space-y-1.5 animate-fade-in">
                      <label className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Custom Agent ID Label</label>
                      <input
                        type="text"
                        value={customAgentName}
                        onChange={(e) => setCustomAgentName(e.target.value)}
                        placeholder="e.g. Agent Somya"
                        className="w-full px-4 py-2 bg-white border border-indigo-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500/20 font-medium"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold py-3.5 px-6 rounded-xl transition flex items-center justify-center gap-2 shadow-md hover:shadow-lg focus:ring-2 cursor-pointer active:scale-98"
          >
            {loading ? <RefreshCw className="w-4.5 h-4.5 animate-spin" /> : (
              isRegistering ? "Register & Enter Helpdesk" : "Sign In to Helpdesk"
            )}
          </button>
        </form>

        <div className="border-t pt-4 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError(null);
            }}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline transition"
          >
            {isRegistering 
              ? "Already have an account? Sign In" 
              : "Don't have an account? Sign Up & Save to DB"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem("helpdesk_jwt_token"));
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [initLoading, setInitLoading] = useState(true);

  // Authenticate via token on page load/refreshes
  const authenticateUserOnStartup = async (savedToken: string) => {
    try {
      const res = await fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${savedToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentUser(data.user);
      } else {
        handleClearAuth();
      }
    } catch {
      handleClearAuth();
    } finally {
      setInitLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      authenticateUserOnStartup(token);
    } else {
      setInitLoading(false);
    }
  }, [token]);

  const handleLoginSuccess = (newToken: string, userProf: UserProfile) => {
    localStorage.setItem("helpdesk_jwt_token", newToken);
    setToken(newToken);
    setCurrentUser(userProf);
  };

  const handleClearAuth = () => {
    localStorage.removeItem("helpdesk_jwt_token");
    setToken(null);
    setCurrentUser(null);
  };

  if (initLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50">
        <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin mb-4" />
        <h2 className="text-gray-700 font-bold text-sm tracking-tight">Initializing Helpdesk Database Channels...</h2>
      </div>
    );
  }

  if (!token || !currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50/70 via-slate-50 to-blue-50/70 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Glowing background blobs */}
        <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] bg-indigo-200/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[50%] h-[50%] bg-blue-200/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-[30%] left-[50%] w-[35%] h-[35%] bg-pink-100/30 rounded-full blur-3xl pointer-events-none" />
        
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f080_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f080_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />

        <div className="relative z-10 w-full max-w-md">
          <WelcomeGuestLogin onLoginSuccess={handleLoginSuccess} />
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
        {/* Navigation Indicator Header */}
        <NavigationHeader currentUser={currentUser} onLogout={handleClearAuth} />

        {/* Content Container */}
        <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 space-y-8">
          
          {/* Top Realtime Simulator Bar */}
          <div className="space-y-2">
            <AuthSwitcher 
              currentUser={currentUser} 
              onLoginSuccess={handleLoginSuccess} 
              onLogout={handleClearAuth} 
            />
          </div>

          <Routes>
            <Route path="/" element={<Dashboard token={token} />} />
            <Route path="/tickets" element={<TicketList token={token} currentUser={currentUser} />} />
            <Route path="/create-ticket" element={<CreateTicket token={token} />} />
            <Route path="/tickets/:id" element={<TicketDetail token={token} currentUser={currentUser} />} />
            <Route path="/admin" element={currentUser.role === 'admin' ? <AdminPanel token={token} /> : <Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
