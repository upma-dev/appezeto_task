import React, { useEffect, useState } from "react";
import { ShieldCheck, Users, UserCog, UserMinus, ShieldAlert, CheckCircle2, RefreshCw, Layers, Award, Clock } from "lucide-react";

interface AdminPanelProps {
  token: string;
}

interface DBUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  agentName: string | null;
  createdAt: string;
}

export default function AdminPanel({ token }: AdminPanelProps) {
  const [users, setUsers] = useState<DBUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // SLA State Config Limits
  const [slaMetrics, setSlaMetrics] = useState({
    ResponseCritical: 30,
    ResponseHigh: 60,
    ResponseMedium: 180,
    ResponseLow: 360,
  });

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/users", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error("Unable to fetch user registers. Admin token authorization required.");
      }
      const data = await res.json();
      setUsers(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string, defaultAgentName?: string) => {
    setActionLoadingId(userId);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/auth/users/${userId}/role`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          role: newRole,
          agentName: defaultAgentName || "Riya"
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Failed to update user privileges.");
      }

      const responseData = await res.json();
      setSuccessMsg(`Successfully amended permissions for ${responseData.user.name} to ${responseData.user.role}!`);
      
      // Update local state
      setUsers((prev) =>
        prev.map((el) => (el._id === userId ? { ...el, role: newRole, agentName: newRole === "agent" ? (defaultAgentName || "Riya") : null } : el))
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [token]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <RefreshCw className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
        <p className="text-gray-500 font-bold">Loading Registered Authority Ledger & RBAC policies...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Visual Header */}
      <div className="bg-white border border-gray-100 p-8 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5 font-semibold">
          <div className="flex items-center gap-2">
            <span className="p-1 px-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-full font-black text-[10px] uppercase tracking-wider block">
              Authority Deck
            </span>
          </div>
          <h2 className="text-2xl font-black text-gray-900 tracking-tight flex items-center gap-2.5 mt-1.5">
            <ShieldCheck className="w-7 h-7 text-rose-600 shrink-0" />
            Security Shield & RBAC Control Panel
          </h2>
          <p className="text-xs text-gray-500 font-medium">
            Manage live system operators, elevate customer privilege settings, and fine-tune response targets directly in MongoDB.
          </p>
        </div>
        <button 
          onClick={fetchUsers}
          className="px-4 py-2 bg-gray-50 hover:bg-gray-100 border text-gray-700 text-xs font-bold rounded-xl transition flex items-center gap-2 self-start md:self-auto"
        >
          <RefreshCw className="w-4 h-4 text-gray-500" /> Re-index Operators
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border-2 border-red-200 text-red-800 rounded-xl p-5 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
          <div>
            <span className="font-bold block">Authority Restriction Notice</span>
            <span className="text-xs">{error}</span>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-50 border-2 border-emerald-200 text-emerald-800 rounded-xl p-4 flex items-center gap-3 animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span className="text-xs font-bold">{successMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* User List and Role Allocator Card (2 cols) */}
        <div className="lg:col-span-2 bg-white rounded-3xl border-2 border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="font-extrabold text-gray-900 text-base flex items-center gap-2.5">
              <Users className="w-5 h-5 text-indigo-600" />
              Registered System Operators ({users.length})
            </h3>
            <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-100 font-bold">
              Active Storage: MongoDB
            </span>
          </div>

          <div className="divide-y divide-gray-100 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-400 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="p-4 pl-6">Operator details</th>
                  <th className="p-4">Assigned Role</th>
                  <th className="p-4">Mapped Identity</th>
                  <th className="p-4 pr-6 text-right">Amended Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {users.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-4 pl-6">
                      <div className="space-y-0.5">
                        <span className="text-gray-900 font-bold block text-sm">{item.name}</span>
                        <span className="text-gray-400 text-xs font-mono">{item.email}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-extrabold uppercase ${
                        item.role === "admin" ? "bg-rose-50 border-rose-200 text-rose-700" :
                        item.role === "agent" ? "bg-amber-50 border-amber-200 text-amber-700" :
                        "bg-blue-50 border-blue-200 text-blue-700"
                      }`}>
                        {item.role}
                      </span>
                    </td>
                    <td className="p-4">
                      {item.role === "agent" ? (
                        <div className="flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-gray-700 font-extrabold text-xs">Agent: {item.agentName || "Unassigned"}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs italic">Not Applicable</span>
                      )}
                    </td>
                    <td className="p-4 pr-6 text-right">
                      {actionLoadingId === item._id ? (
                        <RefreshCw className="w-4 h-4 animate-spin text-indigo-600 inline" />
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          {item.role !== "customer" && (
                            <button
                              onClick={() => handleRoleChange(item._id, "customer")}
                              className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-[10px] font-extrabold transition"
                              title="Demote to Customer"
                            >
                              Make Customer
                            </button>
                          )}
                          {item.role !== "agent" && (
                            <select
                              onChange={(e) => handleRoleChange(item._id, "agent", e.target.value)}
                              className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg text-[10px] font-extrabold transition border-none outline-none cursor-pointer"
                              defaultValue=""
                            >
                              <option value="" disabled>Make Agent...</option>
                              <option value="Riya">Agent Riya (Tier 1)</option>
                              <option value="Karan">Agent Karan (Tier 2)</option>
                              <option value="Dev">Agent Dev (SRE)</option>
                            </select>
                          )}
                          {item.role !== "admin" && (
                            <button
                              onClick={() => handleRoleChange(item._id, "admin")}
                              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[10px] font-extrabold transition"
                              title="Promote to Administrator"
                            >
                              Make Admin
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* SLA and Security Policy Card (1 col) */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-3xl border-2 border-slate-200 shadow-sm space-y-5">
            <h3 className="font-extrabold text-gray-900 text-base flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" /> SLA Threshold Limits (mins)
            </h3>
            <p className="text-xs text-gray-400 leading-relaxed font-semibold block">
              Configure automated tracking durations for new tickets. Transgressing these values sounds visual warnings on dashboards.
            </p>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-gray-600">
                  <span className="text-rose-600 uppercase">Critical Priority</span>
                  <span>{slaMetrics.ResponseCritical} Mins</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="120"
                  step="5"
                  value={slaMetrics.ResponseCritical}
                  onChange={(e) => setSlaMetrics({ ...slaMetrics, ResponseCritical: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-rose-600"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-gray-600">
                  <span className="text-amber-600 uppercase">High Priority</span>
                  <span>{slaMetrics.ResponseHigh} Mins</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="240"
                  step="10"
                  value={slaMetrics.ResponseHigh}
                  onChange={(e) => setSlaMetrics({ ...slaMetrics, ResponseHigh: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-gray-600">
                  <span className="text-emerald-700 uppercase">Medium Priority</span>
                  <span>{slaMetrics.ResponseMedium} Mins</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="480"
                  step="20"
                  value={slaMetrics.ResponseMedium}
                  onChange={(e) => setSlaMetrics({ ...slaMetrics, ResponseMedium: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-gray-600">
                  <span className="text-blue-600 uppercase">Low Priority</span>
                  <span>{slaMetrics.ResponseLow} Mins</span>
                </div>
                <input
                  type="range"
                  min="120"
                  max="1440"
                  step="30"
                  value={slaMetrics.ResponseLow}
                  onChange={(e) => setSlaMetrics({ ...slaMetrics, ResponseLow: parseInt(e.target.value) })}
                  className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-gray-100 text-[11px] text-gray-500 font-semibold leading-relaxed">
              * Note: These parameters synchronize dynamically with system routing background nodes to optimize performance metrics.
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-900 to-indigo-950 p-6 rounded-3xl text-white shadow-md space-y-4">
            <h3 className="font-extrabold text-sm uppercase tracking-wide text-indigo-300 flex items-center gap-2">
              <Layers className="w-5 h-5" /> Security Checklist
            </h3>
            <ul className="space-y-2.5 text-xs text-indigo-100 font-medium">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full shrink-0" />
                <span>Standard JWT Session Timeout: 1 Day</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full shrink-0" />
                <span>MongoDB Password Hashes: Bcrypt Salt(10)</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full shrink-0" />
                <span>Inline FAST Status updates: Auto-audit log</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full shrink-0 animate-ping" />
                <span>RBAC Strict API Guard Verification: Enabled</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
