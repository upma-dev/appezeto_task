import React, { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Ticket, Stats } from "../types.js";
import { 
  Filter, Search, ArrowUpDown, ChevronLeft, ChevronRight, 
  Clock, AlertTriangle, CheckCircle2, User, HelpCircle, AlertCircle, RefreshCw
} from "lucide-react";

interface TicketListProps {
  token: string;
  currentUser: { id: string; name: string; role: string; agentName?: string | null };
}

export function formatRelativeTime(dateString: string): string {
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now.getTime() - past.getTime();
  
  if (diffMs < 1000) return "Just now";
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHour < 24) return `${diffHour}h ago`;
  return `${diffDay}d ago`;
}

export default function TicketList({ token, currentUser }: TicketListProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "error" | "info">("success");

  // Keep a reference to tickets for live polling comparisons
  const ticketsRef = useRef<Ticket[]>([]);
  ticketsRef.current = tickets;

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchValue);
      setPage(1); // Reset page on filter edit
    }, 400);
    return () => clearTimeout(handler);
  }, [searchValue]);

  // Toast helper
  const triggerToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToastMessage(message);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Load Tickets and metadata
  const fetchTickets = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const url = `/api/tickets?status=${statusFilter}&priority=${priorityFilter}&search=${debouncedSearch}&sort=${sortBy}&page=${page}&limit=6`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Could not retrieve tickets list.");
      const data = await res.json();

      // For live polling: compare if new tickets came back and if we should show a background update toast!
      if (silent && ticketsRef.current.length > 0) {
        const idMap = new Map(ticketsRef.current.map(t => [t._id, t.version]));
        let updateCount = 0;
        data.tickets.forEach((t: Ticket) => {
          if (!idMap.has(t._id) || idMap.get(t._id) !== t.version) {
            updateCount++;
          }
        });
        if (updateCount > 0) {
          triggerToast(`${updateCount} tickets updated in real-time.`, "info");
        }
      }

      setTickets(data.tickets);
      setTotalPages(data.totalPages || 1);
      setError(null);
    } catch (err: any) {
      if (!silent) setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Fetch Stats counts
  const fetchStats = async () => {
    try {
      const res = await fetch("/api/tickets/stats", {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const statsData = await res.json();
        setStats(statsData);
      }
    } catch (err) {
      console.warn("Failed loading ticket micro-stats counts", err);
    }
  };

  useEffect(() => {
    fetchTickets();
    fetchStats();
  }, [statusFilter, priorityFilter, debouncedSearch, sortBy, page, token]);

  // Live polling every 5 seconds as requested in machine test PDF instruction
  useEffect(() => {
    const timer = setInterval(() => {
      fetchTickets(true); // Silent update preserving page, scroll positions
      fetchStats();
    }, 5000);
    return () => clearInterval(timer);
  }, [statusFilter, priorityFilter, debouncedSearch, sortBy, page, token]);

  // Optimistic Status Transition with rollback
  const handleInlineStatusChange = async (ticket: Ticket, newStatus: string) => {
    const oldStatus = ticket.status;

    // 1. Instantly perform optimistic UI update
    const updatedTickets = tickets.map((t) => {
      if (t._id === ticket._id) {
        return { ...t, status: newStatus as any };
      }
      return t;
    });
    setTickets(updatedTickets);
    triggerToast(`Optimistically updating status of ticket T-${ticket._id.substring(ticket._id.length - 4).toUpperCase()}...`, "info");

    // 2. Perform background API check
    try {
      const response = await fetch(`/api/tickets/${ticket._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status: newStatus,
          version: ticket.version // mandatory optimistic lock check
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed changing ticket status.");
      }

      const updatedTicketObjFromDB = await response.json();
      
      // Update with exact database record
      setTickets((prev) => 
        prev.map((t) => (t._id === ticket._id ? updatedTicketObjFromDB : t))
      );
      triggerToast(`Status updated successfully! Ticket T-${ticket._id.substring(ticket._id.length - 4).toUpperCase()} is now '${newStatus}'.`, "success");
      fetchStats(); // Update stats since status moved
    } catch (err: any) {
      // 3. Rollback changes on rejection
      console.error("Status update error. Rolling back...", err);
      setTickets((prev) => 
        prev.map((t) => (t._id === ticket._id ? { ...t, status: oldStatus } : t))
      );
      triggerToast(`Transaction Refused: ${err.message}`, "error");
    }
  };

  // Check valid status moves for inline select fields
  const getNextValidStatuses = (currentStatus: string) => {
    if (currentStatus === "Closed") return [];
    if (currentStatus === "Queued") return ["Open", "Closed"];
    if (currentStatus === "Open") return ["In Progress", "Closed"];
    if (currentStatus === "In Progress") return ["Resolved", "Closed"];
    if (currentStatus === "Resolved") return ["In Progress", "Closed"];
    return [];
  };

  return (
    <div className="space-y-6">
      {/* Mini-Stats Bar */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 bg-gray-50/50 p-4 border border-gray-100 rounded-2xl">
          <div className="text-center p-2 border-r border-gray-100 last:border-0">
            <span className="text-xs text-gray-400 font-medium">Queued</span>
            <p className="text-lg font-bold text-slate-500 mt-1">{stats.counts.status.Queued}</p>
          </div>
          <div className="text-center p-2 border-r border-gray-100 last:border-0">
            <span className="text-xs text-gray-400 font-medium">Open / Assigned</span>
            <p className="text-lg font-bold text-indigo-600 mt-1">{stats.counts.status.Open}</p>
          </div>
          <div className="text-center p-2 border-r border-gray-100 last:border-0">
            <span className="text-xs text-gray-400 font-medium">In Progress</span>
            <p className="text-lg font-bold text-amber-500 mt-1">{stats.counts.status["In Progress"]}</p>
          </div>
          <div className="text-center p-2 border-r border-gray-100 last:border-0">
            <span className="text-xs text-gray-400 font-medium">Resolved</span>
            <p className="text-lg font-bold text-emerald-500 mt-1">{stats.counts.status.Resolved}</p>
          </div>
          <div className="text-center p-2 last:border-0">
            <span className="text-xs text-gray-400 font-medium">Closed</span>
            <p className="text-lg font-bold text-slate-700 mt-1">{stats.counts.status.Closed}</p>
          </div>
        </div>
      )}

      {/* Sticky Banner Notification Toasts */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-sm font-medium border ${
          toastType === "success" ? "bg-emerald-50 border-emerald-200 text-emerald-800" :
          toastType === "error" ? "bg-red-50 border-red-200 text-red-800" :
          "bg-indigo-50 border-indigo-200 text-indigo-800"
        } animate-bounce`}>
          {toastType === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
          {toastType === "error" && <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />}
          {toastType === "info" && <RefreshCw className="w-5 h-5 text-indigo-600 animate-spin shrink-0" />}
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Filter Options Panel */}
      <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Status Dropdown */}
          <div className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-3 py-1.5 bg-gray-50/50">
            <Filter className="w-4 h-4 text-gray-400" />
            <select 
              value={statusFilter} 
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="text-xs font-semibold text-gray-600 bg-transparent border-none outline-none focus:ring-0"
            >
              <option value="">All Statuses</option>
              <option value="Queued">Queued</option>
              <option value="Open">Open</option>
              <option value="In Progress">In Progress</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
            </select>
          </div>

          {/* Priority Dropdown */}
          <div className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-3 py-1.5 bg-gray-50/50">
            <AlertCircle className="w-4 h-4 text-gray-400" />
            <select 
              value={priorityFilter} 
              onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
              className="text-xs font-semibold text-gray-600 bg-transparent border-none outline-none focus:ring-0"
            >
              <option value="">All Priorities</option>
              <option value="Low">Low</option>
              <option value="Medium">Medium</option>
              <option value="High">High</option>
              <option value="Critical">Critical</option>
            </select>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-3 py-1.5 bg-gray-50/50">
            <ArrowUpDown className="w-4 h-4 text-gray-400" />
            <select 
              value={sortBy} 
              onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
              className="text-xs font-semibold text-gray-600 bg-transparent border-none outline-none focus:ring-0"
            >
              <option value="newest">Sort: Newest</option>
              <option value="oldest">Sort: Oldest</option>
              <option value="priority">Sort: Primary Urgency</option>
            </select>
          </div>
        </div>

        {/* Text Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search matching content..." 
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-xs bg-gray-50/50 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
          />
        </div>
      </div>

      {/* Main Tickets display */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
          <p className="text-gray-400 text-xs font-medium">Syncing customer support database...</p>
        </div>
      ) : error ? (
        <div className="text-center py-16 bg-red-50 rounded-2xl border border-red-100 p-8">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
          <h3 className="font-bold text-gray-800 text-lg mt-3">An error occurred</h3>
          <p className="text-gray-500 text-sm mt-1">{error}</p>
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-20 bg-gray-50 rounded-2xl border border-gray-100 p-8">
          <HelpCircle className="w-12 h-12 text-gray-300 mx-auto" />
          <h3 className="font-bold text-gray-700 text-lg mt-4">No tickets verified matching criteria</h3>
          <p className="text-gray-400 text-xs mt-1">Amend filters or register a new request to load activities.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {tickets.map((t) => {
            // Colors for Priority badge
            const priorityColors = {
              Low: "bg-blue-50 text-blue-700 border-blue-100",
              Medium: "bg-emerald-50 text-emerald-700 border-emerald-100",
              High: "bg-amber-50 text-amber-700 border-amber-100",
              Critical: "bg-red-50 text-red-700 border-red-100"
            };

            // Colors for Status badge
            const statusColors = {
              Queued: "bg-slate-100 text-slate-700 border-slate-200",
              Open: "bg-indigo-50 text-indigo-700 border-indigo-100",
              "In Progress": "bg-yellow-50 text-yellow-700 border-yellow-100",
              Resolved: "bg-emerald-100 text-emerald-800 border-emerald-200",
              Closed: "bg-gray-100 text-gray-600 border-gray-200"
            };

            // SLA State Colors
            const slaStateColors = {
              ok: "text-emerald-600 bg-emerald-50 border-emerald-100",
              at_risk: "text-amber-500 bg-amber-50 border-amber-100 animate-pulse",
              breached: "text-red-500 bg-red-50 border-red-100 font-bold"
            };

            const nextActions = getNextValidStatuses(t.status);

            return (
              <div 
                key={t._id} 
                className={`bg-white rounded-2xl border-2 border-gray-200 shadow-md hover:border-indigo-400 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col p-6 space-y-4 ${
                  t.priority === "Critical" ? "border-l-4 border-l-rose-500" :
                  t.priority === "High" ? "border-l-4 border-l-amber-500" :
                  t.priority === "Medium" ? "border-l-4 border-l-emerald-400" :
                  "border-l-4 border-l-blue-400"
                }`}
              >
                {/* Header indicators */}
                <div className="flex justify-between items-start gap-2">
                  <span className="text-[10px] font-mono tracking-wider font-extrabold text-gray-500 bg-gray-100 px-2 py-0.5 rounded uppercase">
                    T-{t._id.substring(t._id.length - 4).toUpperCase()} (v{t.version})
                  </span>
                  
                  {/* Category Badge */}
                  <span className="text-[10px] px-2.5 py-1 bg-indigo-50 rounded-md border border-indigo-100 text-indigo-700 font-extrabold uppercase tracking-wider">
                    {t.category}
                  </span>
                </div>

                {/* Title and Short Description */}
                <div className="space-y-1.5">
                  <Link 
                    to={`/tickets/${t._id}`} 
                    className="font-extrabold text-gray-900 text-base md:text-lg hover:text-indigo-600 line-clamp-1 block transition-colors leading-tight"
                  >
                    {t.title}
                  </Link>
                  <p className="text-xs text-gray-600 line-clamp-2 md:line-clamp-3 leading-relaxed font-medium">
                    {t.description}
                  </p>
                </div>

                {/* Classification Badges */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className={`text-[10px] uppercase font-extrabold tracking-wider px-2.5 py-1 border-2 rounded-full ${priorityColors[t.priority]}`}>
                    {t.priority}
                  </span>
                  <span className={`text-[10px] uppercase font-extrabold tracking-wider px-2.5 py-1 border-2 rounded-full ${statusColors[t.status]}`}>
                    {t.status}
                  </span>

                  {/* SLA Countdown Badge */}
                  {t.status !== "Resolved" && t.status !== "Closed" && (
                    <span className={`text-[10px] font-extrabold tracking-wider px-2.5 py-1 border-2 rounded-full flex items-center gap-1.5 uppercase ${slaStateColors[t.slaState]}`}>
                      <span className="w-1.5 h-1.5 bg-current rounded-full" />
                      SLA: {t.slaState}
                    </span>
                  )}
                </div>

                {/* Divider line */}
                <div className="border-t-2 border-gray-100 pt-4 mt-auto flex items-center justify-between gap-4 text-xs">
                  <div className="flex items-center gap-1.5 text-gray-500 font-bold">
                    <User className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Assignee:</span>
                    <span className="text-gray-900 font-black">{t.assignedAgent || "Unassigned"}</span>
                  </div>
                  <span className="text-[10px] font-extrabold text-gray-600 whitespace-nowrap bg-gray-100 px-2.5 py-1 rounded">
                    {formatRelativeTime(t.createdAt)}
                  </span>
                </div>

                {/* Inline Change Dropdown */}
                {nextActions.length > 0 && (
                  <div className="border-t-2 border-gray-100 pt-3 flex items-center justify-between gap-1">
                    <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider">Fast Action:</span>
                    <select
                      value={t.status}
                      onChange={(e) => handleInlineStatusChange(t, e.target.value)}
                      className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg px-2 py-1 outline-none text-right cursor-pointer"
                    >
                      <option value={t.status} disabled>{t.status}</option>
                      {nextActions.map((act) => (
                        <option key={act} value={act}>Move to: {act}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 pt-6">
          <button 
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 text-xs font-bold text-gray-600 border border-gray-200 rounded-xl px-3.5 py-2 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent transition shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
            Prev
          </button>
          
          <span className="text-xs font-semibold text-gray-500">
            Page {page} of {totalPages}
          </span>

          <button 
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1 text-xs font-bold text-gray-600 border border-gray-200 rounded-xl px-3.5 py-2 hover:bg-gray-50 disabled:opacity-40 disabled:hover:bg-transparent transition shrink-0"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
