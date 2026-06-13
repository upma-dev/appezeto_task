import React, { useEffect, useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";
import { Stats } from "../types.js";
import { AlertCircle, Clock, CheckCircle2, UserCheck, ShieldAlert, BarChart3, Users, Loader2, RefreshCw } from "lucide-react";

interface DashboardProps {
  token: string;
}

export default function Dashboard({ token }: DashboardProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [lastSynced, setLastSynced] = useState<string>(new Date().toLocaleTimeString());
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/tickets/stats", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) {
        throw new Error("Failed to load statistics indicators.");
      }
      const data = await res.json();
      setStats(data);
      setLastSynced(new Date().toLocaleTimeString());
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Refresh stats every 10 seconds
    const interval = setInterval(fetchStats, 10000);
    return () => clearInterval(interval);
  }, [token]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 min-h-[400px]">
        <Loader2 className="w-10 h-10 animate-spin text-indigo-600 mb-4" />
        <p className="text-gray-500 font-medium">Crunching ticket analytics and load configurations...</p>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-6 my-6 flex items-start gap-4">
        <ShieldAlert className="w-6 h-6 text-red-600 shrink-0" />
        <div>
          <h3 className="font-semibold text-lg">Failed to load Dashboard data</h3>
          <p className="text-sm text-red-700 mt-1">{error || "Please verify your database connection."}</p>
          <button onClick={fetchStats} className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 transition">
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // Map stats for Recharts Bar Chart
  const statusChartData = [
    { name: "Queued", Tickets: stats.counts.status.Queued, color: "#94a3b8" },
    { name: "Open", Tickets: stats.counts.status.Open, color: "#6366f1" },
    { name: "Active", Tickets: stats.counts.status["In Progress"], color: "#f59e0b" },
    { name: "Resolved", Tickets: stats.counts.status.Resolved, color: "#10b981" },
    { name: "Closed", Tickets: stats.counts.status.Closed, color: "#374151" }
  ];

  const priorityChartData = [
    { name: "Low", Count: stats.counts.priority.Low, color: "#3b82f6" },
    { name: "Medium", Count: stats.counts.priority.Medium, color: "#10b981" },
    { name: "High", Count: stats.counts.priority.High, color: "#f59e0b" },
    { name: "Critical", Count: stats.counts.priority.Critical, color: "#ef4444" }
  ];

  const totalTicketsCount = 
    stats.counts.status.Queued + 
    stats.counts.status.Open + 
    stats.counts.status["In Progress"] + 
    stats.counts.status.Resolved + 
    stats.counts.status.Closed;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Dynamic attractive header dashboard banner */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-slate-800 p-8 rounded-3xl text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold tracking-widest uppercase bg-indigo-600 text-indigo-100 px-3 py-1 rounded-full">
              Live Operations
            </span>
            <span className="text-xs text-indigo-300 font-bold">
              • Auto-routed & load-balanced
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white leading-none">
            Helpdesk Dispatch Command
          </h1>
          <p className="text-xs text-slate-300 max-w-xl font-medium">
            Monitor real-time agent allocations, outstanding service agreements, and system SLAs. Switch personas to audit role filters.
          </p>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <div className="text-right">
            <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Database Channel</span>
            <span className="text-xs font-mono font-bold text-slate-200">Synced: {lastSynced}</span>
          </div>
          <button
            onClick={() => fetchStats()}
            disabled={refreshing}
            className="p-3 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-2xl border border-white/15 transition flex items-center justify-center"
            title="Force Analytics Sync"
          >
            <RefreshCw className={`w-4.5 h-4.5 ${refreshing ? "animate-spin text-indigo-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div id="metric-total" className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-gray-400 tracking-wider uppercase block">Total Tickets</span>
            <span className="text-3xl font-bold text-gray-800">{totalTicketsCount}</span>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
            <BarChart3 className="w-6 h-6" />
          </div>
        </div>

        <div id="metric-active" className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-gray-400 tracking-wider uppercase block">Active Load</span>
            <span className="text-3xl font-bold text-amber-600">{stats.totals.active}</span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        <div id="metric-queued" className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-gray-400 tracking-wider uppercase block">Queued Backlog</span>
            <span className="text-3xl font-bold text-slate-500">{stats.totals.queued}</span>
          </div>
          <div className="p-3 bg-slate-50 text-slate-500 rounded-2xl">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>

        <div id="metric-resolved" className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-gray-400 tracking-wider uppercase block">Resolved count</span>
            <span className="text-3xl font-bold text-emerald-600">{stats.counts.status.Resolved + stats.counts.status.Closed}</span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Grid of Visualizations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Status Distribution Recharts Bar Chart */}
        <div id="chart-status-card" className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col space-y-4">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            Tickets Classification by Status
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={statusChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={11} stroke="#94a3b8" />
                <YAxis fontSize={11} stroke="#94a3b8" type="number" allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#1e293b", color: "#f8fafc", borderRadius: "12px", border: "none" }}
                  labelStyle={{ fontWeight: "bold" }}
                />
                <Bar dataKey="Tickets" radius={[6, 6, 0, 0]}>
                  {statusChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Priority Distribution Bar Chart */}
        <div id="chart-priority-card" className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm flex flex-col space-y-4">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-rose-600" />
            Volume Distribution by Priority
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={priorityChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" fontSize={11} stroke="#94a3b8" />
                <YAxis fontSize={11} stroke="#94a3b8" type="number" allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "#1e293b", color: "#f8fafc", borderRadius: "12px", border: "none" }}
                  labelStyle={{ fontWeight: "bold" }}
                />
                <Bar dataKey="Count" radius={[6, 6, 0, 0]}>
                  {priorityChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* SLA and Agent Load Balancer Monitor */}
      <div id="agents-utilization-panel" className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            Real-time Load Balancing Agent Pool
          </h3>
          <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-50 text-indigo-700 rounded-full animate-pulse">
            Active Auto-routing
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.agents.map((agent) => {
            const isFull = agent.active >= agent.maxLoad;
            let barColor = "bg-indigo-600";
            if (agent.utilization >= 100) barColor = "bg-red-500 animate-pulse";
            else if (agent.utilization >= 75) barColor = "bg-amber-500";

            return (
              <div key={agent.name} className={`p-5 rounded-2xl border ${isFull ? 'bg-red-50/40 border-red-100' : 'bg-gray-50/50 border-gray-100'} flex flex-col space-y-4`}>
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-gray-700 text-base">{agent.name}</h4>
                    <p className="text-xs text-gray-400 mt-0.5">Capacity Limit: {agent.maxLoad} load</p>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    isFull ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {isFull ? 'Max Capacity' : 'Available'}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500">Active Load Intensity</span>
                    <span className="font-bold text-gray-700">{agent.active} / {agent.maxLoad} tickets</span>
                  </div>
                  <div className="w-full bg-gray-200 h-3 rounded-full overflow-hidden">
                    <div 
                      className={`${barColor} h-full transition-all duration-500`}
                      style={{ width: `${Math.min(100, agent.utilization)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span>{agent.utilization}% load</span>
                    {isFull && <span className="text-red-500 font-medium">Bounces to Backlog Backplane</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
