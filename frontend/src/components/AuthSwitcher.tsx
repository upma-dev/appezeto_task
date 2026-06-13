import React, { useState } from "react";
import { User, Shield, Users, UserCheck, Key, HelpCircle } from "lucide-react";

interface AuthSwitcherProps {
  onLoginSuccess: (token: string, user: any) => void;
  onLogout: () => void;
  currentUser: any;
}

export default function AuthSwitcher({ onLoginSuccess, onLogout, currentUser }: AuthSwitcherProps) {
  const [switching, setSwitching] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const personas = [
    {
      name: "Somi Mishra (Customer View)",
      email: "customer@helpdesk.com",
      pass: "customer123",
      role: "customer",
      desc: "RBAC: Restricted to only tickets they created."
    },
    {
      name: "Agent Riya (Agent View)",
      email: "riya@helpdesk.com",
      pass: "riya123",
      role: "agent",
      desc: "RBAC: Restricted to assigned (max 3 load) + Queued."
    },
    {
      name: "Agent Karan (Agent View)",
      email: "karan@helpdesk.com",
      pass: "karan123",
      role: "agent",
      desc: "RBAC: Restricted to assigned (max 4 load) + Queued."
    },
    {
      name: "Agent Dev (Agent View)",
      email: "dev@helpdesk.com",
      pass: "dev123",
      role: "agent",
      desc: "RBAC: Restricted to assigned (max 5 load) + Queued."
    },
    {
      name: "Admin Manager (Full View)",
      email: "admin@helpdesk.com",
      pass: "admin123",
      role: "admin",
      desc: "RBAC: Absolute database read/write access + full metrics."
    }
  ];

  const handlePersonaSwitch = async (email: string, pass: string) => {
    setSwitching(true);
    setErr(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password: pass })
      });
      if (!res.ok) {
        throw new Error("Unable to log in using persona credentials.");
      }
      const data = await res.json();
      onLoginSuccess(data.token, data.user);
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="bg-slate-800 text-slate-100 p-6 rounded-3xl border border-slate-700 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Key className="w-4 h-4 text-amber-400" />
            Interview Evaluation Simulator
          </h3>
          <p className="text-[10px] text-slate-400">
            Switch simulation profiles in real-time to audit database filters and security behaviors:
          </p>
        </div>

        {currentUser && (
          <div className="flex items-center gap-2.5 bg-slate-900 border border-slate-700 px-4 py-2 rounded-xl text-xs">
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping shrink-0" />
            <div className="text-left">
              <span className="text-[10px] text-gray-400 font-semibold block uppercase">Active Profile</span>
              <span className="font-bold text-slate-200">
                {currentUser.name} ({currentUser.role})
              </span>
            </div>
            <button 
              onClick={onLogout}
              className="ml-4 px-2.5 py-1.5 bg-red-600/20 hover:bg-red-500 hover:text-white rounded text-[10px] font-bold text-red-400 transition"
            >
              Sign Out
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
        {personas.map((p) => {
          const isCurrent = currentUser?.email === p.email;
          return (
            <button
              key={p.email}
              disabled={switching || isCurrent}
              onClick={() => handlePersonaSwitch(p.email, p.pass)}
              className={`text-left p-3.5 rounded-2xl border transition-all flex flex-col space-y-1 ${
                isCurrent 
                  ? "bg-indigo-600 hover:bg-indigo-600 text-white border-indigo-400 scale-[1.02] shadow"
                  : "bg-slate-900 text-slate-200 border-slate-800 hover:border-slate-600 active:scale-95"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold truncate pr-1">{p.name.split(" ")[0]}</span>
                {p.role === "admin" ? <Shield className="w-3.5 h-3.5 shrink-0 text-amber-400" /> :
                 p.role === "agent" ? <Users className="w-3.5 h-3.5 shrink-0 text-indigo-400" /> :
                 <UserCheck className="w-3.5 h-3.5 shrink-0 text-emerald-400" />}
              </div>
              <span className="text-[9px] text-slate-400 font-semibold truncate leading-none block">
                {p.role.toUpperCase()}
              </span>
              <span className="text-[8px] text-slate-500 pt-1.5 font-medium leading-normal line-clamp-2">
                {p.desc}
              </span>
            </button>
          );
        })}
      </div>

      {err && (
        <p className="text-[10px] text-red-400 font-semibold">
          * switch failed: {err}
        </p>
      )}
    </div>
  );
}
