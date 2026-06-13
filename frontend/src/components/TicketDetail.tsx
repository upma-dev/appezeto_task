import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Ticket, Comment, HistoryEntry, AISuggestion } from "../types.js";
import { 
  ArrowLeft, Clock, MessageSquare, AlertTriangle, Send, RefreshCw, 
  Sparkles, History, User, CheckCircle2, ShieldAlert, Cpu
} from "lucide-react";

interface TicketDetailProps {
  token: string;
  currentUser: { id: string; name: string; role: string; agentName?: string | null };
}

// SLA constant total ms for ratio computation
const SLA_DURATIONS: Record<string, number> = {
  Critical: 2 * 60 * 60 * 1000,
  High: 8 * 60 * 60 * 1000,
  Medium: 24 * 60 * 60 * 1000,
  Low: 72 * 60 * 60 * 1000
};

export default function TicketDetail({ token, currentUser }: TicketDetailProps) {
  const { id } = useParams<{ id: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Comments
  const [commentText, setCommentText] = useState("");
  const [commentPending, setCommentPending] = useState(false);

  // Status Change State
  const [statusPending, setStatusPending] = useState(false);

  // SLA Live Countdown State
  const [timeLeftStr, setTimeLeftStr] = useState("00:00:00");
  const [slaStateColor, setSlaStateColor] = useState("text-emerald-600 bg-emerald-50");

  // Gemini AI Assistant State
  const [aiSuggestion, setAiSuggestion] = useState<AISuggestion | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // HTTP 409 Mismatch / Conflict Resolution States
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictMineStatus, setConflictMineStatus] = useState("");
  const [conflictTheirsDoc, setConflictTheirsDoc] = useState<Ticket | null>(null);

  // Toast
  const [toast, setToast] = useState<{ text: string; type: "success" | "error" | "info" } | null>(null);

  // Admin Configuration States
  const [adminCategory, setAdminCategory] = useState("Bug");
  const [adminPriority, setAdminPriority] = useState("Medium");
  const [adminAgent, setAdminAgent] = useState<string | null>(null);
  const [adminSaving, setAdminSaving] = useState(false);

  const showToast = (text: string, type: "success" | "error" | "info" = "success") => {
    setToast({ text, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (ticket) {
      setAdminCategory(ticket.category);
      setAdminPriority(ticket.priority);
      setAdminAgent(ticket.assignedAgent);
    }
  }, [ticket]);

  const handleAdminUpdate = async () => {
    if (!ticket) return;
    setAdminSaving(true);
    showToast("Applying administration changes...", "info");
    try {
      const res = await fetch(`/api/tickets/${ticket._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          category: adminCategory,
          priority: adminPriority,
          assignedAgent: adminAgent,
          version: ticket.version
        })
      });

      if (res.status === 409) {
        const errData = await res.json();
        setConflictTheirsDoc(errData.ticket);
        setConflictModalOpen(true);
        setTicket(errData.ticket);
        showToast("Conflict: Edited by another session.", "error");
        return;
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Failed to update configurations.");
      }

      const updated = await res.json();
      setTicket(updated);
      showToast("Ticket configuration saved successfully!", "success");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setAdminSaving(false);
    }
  };

  const fetchTicketDetails = async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    try {
      const res = await fetch(`/api/tickets/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        throw new Error("Unable to locate ticket documentation files.");
      }
      const data = await res.json();
      setTicket(data);
      setError(null);
    } catch (err: any) {
      if (!isSilent) setError(err.message);
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicketDetails();
  }, [id, token]);

  // Live Timer Countdown Loop
  useEffect(() => {
    if (!ticket || ticket.status === "Resolved" || ticket.status === "Closed") {
      return;
    }

    const interval = setInterval(() => {
      const deadline = new Date(ticket.slaDeadline).getTime();
      const createdAt = new Date(ticket.createdAt).getTime();
      const now = Date.now();

      const msLeft = deadline - now;
      const totalSlaMs = SLA_DURATIONS[ticket.priority] || (24 * 60 * 60 * 1000);
      const ratio = msLeft / totalSlaMs;

      // Classify countdown state alerts
      if (msLeft <= 0) {
        setTimeLeftStr("00m 00s (SLA EXPIRED)");
        setSlaStateColor("text-red-600 bg-red-100 border-red-300 font-bold");
      } else {
        const hours = Math.floor(msLeft / (60 * 60 * 1000));
        const mins = Math.floor((msLeft % (60 * 60 * 1000)) / (60 * 1000));
        const secs = Math.floor((msLeft % (60 * 1000)) / 1000);
        
        let displayStr = `${hours}h ${mins}m ${secs}s`;
        if (hours > 24) {
          const days = Math.floor(hours / 24);
          displayStr = `${days}d ${hours % 24}h ${mins}m`;
        }
        
        setTimeLeftStr(displayStr);

        // Green -> Yellow -> Red based on ratios
        if (ratio <= 0.25) {
          setSlaStateColor("text-red-600 bg-red-50 border-red-200 animate-pulse font-bold");
        } else if (ratio <= 0.5) {
          setSlaStateColor("text-amber-600 bg-amber-50 border-amber-200 font-semibold");
        } else {
          setSlaStateColor("text-emerald-600 bg-emerald-50 border-emerald-100");
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [ticket]);

  // Handle Comment Submission
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (commentText.trim().length < 3) {
      showToast("Comment drafts must contain 3 characters.", "error");
      return;
    }

    setCommentPending(true);
    try {
      const res = await fetch(`/api/tickets/${id}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ text: commentText })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Failed saving comments details.");
      }

      const updatedTicket = await res.json();
      setTicket(updatedTicket);
      setCommentText("");
      showToast("Comment explanation appended.", "success");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setCommentPending(false);
    }
  };

  // Perform Status Transition with 409 Optimistic Lock check
  const handleTransitionStatus = async (newStatus: string) => {
    if (!ticket) return;
    
    const oldStatus = ticket.status;

    // 1. OPTIMISTIC UI STATE UPDATE
    setTicket({ ...ticket, status: newStatus as any });
    setStatusPending(true);
    showToast(`Optimistically updating state...`, "info");

    try {
      const res = await fetch(`/api/tickets/${ticket._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status: newStatus,
          version: ticket.version // Optimistic lock control check
        })
      });

      if (res.status === 409) {
        // 2. CONFLICT DETECTED - Trigger conflict side-by-side resolver
        const errData = await res.json();
        setConflictMineStatus(newStatus);
        setConflictTheirsDoc(errData.ticket);
        setConflictModalOpen(true);
        // Reset ticket to database's last known state
        setTicket(errData.ticket);
        showToast("Access Conflict: This ticket has been edited by another session.", "error");
        return;
      }

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Status change was declined.");
      }

      const verifiedTicket = await res.json();
      setTicket(verifiedTicket);
      showToast(`Status updated successfully to ${newStatus}`, "success");
    } catch (err: any) {
      // ROLLBACK on standard failure
      setTicket({ ...ticket, status: oldStatus });
      showToast(`Rollback: ${err.message}`, "error");
    } finally {
      setStatusPending(false);
    }
  };

  // Conflict Resolution Action: Take Theirs
  const handleTakeTheirs = () => {
    setConflictModalOpen(false);
    setConflictTheirsDoc(null);
    showToast("Server records applied.", "info");
  };

  // Conflict Resolution Action: Retry Mine on Top (Force Override)
  const handleRetryMineOnTop = async () => {
    if (!ticket || !conflictTheirsDoc) return;

    setConflictModalOpen(false);
    setStatusPending(true);
    
    try {
      // Send PATCH again but with the correct, incremented version we just got!
      const res = await fetch(`/api/tickets/${ticket._id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status: conflictMineStatus,
          version: conflictTheirsDoc.version // Use their version to slide in mine on top
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || "Overriding transaction declined.");
      }

      const finalTicket = await res.json();
      setTicket(finalTicket);
      showToast("Overrode successfully! Your status takes precedence.", "success");
    } catch (err: any) {
      showToast(`Override Failed: ${err.message}`, "error");
      fetchTicketDetails(); // hard reload
    } finally {
      setStatusPending(false);
      setConflictTheirsDoc(null);
    }
  };

  // Ask Gemini AI for suggestions
  const triggerAISuggestions = async () => {
    if (!ticket) return;

    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch(`/api/tickets/${ticket._id}/ai-suggest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error("Unable to communicate with Gemini AI Assistant API.");
      }

      const data = await res.json();
      setAiSuggestion(data.aiAnalysis);
      showToast("Gemini AI diagnostic suggestions loaded!", "success");
    } catch (err: any) {
      setAiError(err.message);
    } finally {
      setAiLoading(false);
    }
  };

  // Get allowed legal state machine paths
  const getLegalTransitions = (status: string) => {
    if (status === "Closed") return [];
    if (status === "Queued") return ["Open", "Closed"];
    if (status === "Open") return ["In Progress", "Closed"];
    if (status === "In Progress") return ["Resolved", "Closed"];
    if (status === "Resolved") return ["In Progress", "Closed"];
    return [];
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 min-h-[300px]">
        <RefreshCw className="w-10 h-10 animate-spin text-indigo-600 mb-3" />
        <p className="text-gray-400 text-xs font-semibold">Resolving ticket descriptors and thread links...</p>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="text-center py-16 bg-red-50 rounded-2xl border border-red-100 max-w-xl mx-auto p-8 my-6">
        <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
        <h3 className="font-bold text-gray-800 text-base mt-3">Failed retrieving records.</h3>
        <p className="text-gray-500 text-xs mt-1">{error || "Please secure connectivity profiles."}</p>
        <Link to="/tickets" className="mt-5 inline-flex items-center gap-2 bg-indigo-600 text-white rounded-xl text-xs px-4 py-2 hover:bg-indigo-700 transition font-bold shadow-sm">
          <ArrowLeft className="w-4 h-4" /> Return to Tickets
        </Link>
      </div>
    );
  }

  const legalStatusOptions = getLegalTransitions(ticket.status);

  return (
    <div className="space-y-8 animate-fade-in relative">
      {/* Toast Alert Banner */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-xl text-xs font-bold border border-current ${
          toast.type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-200" :
          toast.type === "error" ? "bg-red-50 text-red-800 border-red-200" :
          "bg-indigo-50 text-indigo-800 border-indigo-200 animate-pulse"
        }`}>
          <span>{toast.text}</span>
        </div>
      )}

      {/* Side-by-Side Conflict Resolution (HTTP 409 Mismatch) Modal */}
      {conflictModalOpen && conflictTheirsDoc && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-8 border border-gray-100 shadow-2xl flex flex-col space-y-6 animate-scale-up">
            <div className="flex items-start gap-4 text-red-600">
              <ShieldAlert className="w-10 h-10 shrink-0 bg-red-50 p-2 rounded-xl" />
              <div>
                <h3 className="text-lg font-bold text-gray-900">Mismatched State Detected!</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Another user session has updated this ticket in the background. Please examine the conflict side-by-side:
                </p>
              </div>
            </div>

            {/* Comparison Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 space-y-2">
                <span className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider block">Your Action Intent</span>
                <p className="text-sm font-bold text-gray-800">Change Status To:</p>
                <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-800 text-xs font-bold rounded-full border border-indigo-200">
                  {conflictMineStatus}
                </span>
                <p className="text-[10px] text-gray-400 pt-2 block font-medium">Saved with local state representation.</p>
              </div>

              <div className="bg-rose-50/50 p-4 rounded-xl border border-rose-100 space-y-2">
                <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">Live Server State (Theirs)</span>
                <p className="text-sm font-bold text-gray-800">Currently Saved status:</p>
                <span className="inline-block px-3 py-1 bg-rose-100 text-rose-800 text-xs font-bold rounded-full border border-rose-200">
                  {conflictTheirsDoc.status}
                </span>
                <p className="text-[10px] text-gray-400 pt-2 block font-medium">Modified by agent/user: {conflictTheirsDoc.history[conflictTheirsDoc.history.length-1]?.by || "System"}</p>
              </div>
            </div>

            {/* Resolution Actions */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-gray-100 justify-end">
              <button
                onClick={handleTakeTheirs}
                className="w-full sm:w-auto px-5 py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-bold text-gray-700 transition"
              >
                Accept Live State [Take Theirs]
              </button>
              <button
                onClick={handleRetryMineOnTop}
                className="w-full sm:w-auto px-5 py-3 bg-slate-800 hover:bg-slate-900 rounded-xl text-xs font-bold text-white transition flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-amber-400" /> Override [Retry Mine on Top]
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header section pathing */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-5">
        <Link to="/tickets" className="text-gray-400 hover:text-indigo-600 font-bold text-xs flex items-center gap-1.5 transition">
          <ArrowLeft className="w-4 h-4" /> Back to helpdesk tickets
        </Link>
        <span className="text-[10px] bg-gray-100 font-mono font-bold text-gray-500 uppercase px-3 py-1.5 rounded border">
          TICKET ID: {ticket._id.substring(ticket._id.length - 8).toUpperCase()} (v{ticket.version})
        </span>
      </div>

      {/* Ticket Details Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Core content column */}
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-gray-800 leading-snug">{ticket.title}</h1>
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-gray-500 font-medium">
                <span className="flex items-center gap-1">
                  <User className="w-4.5 h-4.5 text-slate-400" /> Filed by: <b className="text-gray-700">{ticket.createdByUserName}</b>
                </span>
                <span className="text-gray-300">•</span>
                <span>Category: <b className="text-gray-700">{ticket.category}</b></span>
                <span className="text-gray-300">•</span>
                <span>Created: {new Date(ticket.createdAt).toLocaleDateString()}</span>
              </div>
            </div>

            {/* Content paragraph */}
            <div className="space-y-1.5 border-t border-gray-100 pt-6">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Description Details</span>
              <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line font-medium bg-gray-50/50 p-5 rounded-2xl border border-gray-100/50">
                {ticket.description}
              </p>
            </div>
          </div>

          {/* Gemini AI expert assistant recommendation panel */}
          {currentUser.role !== "customer" && (
            <div className="bg-slate-900 text-slate-100 p-8 rounded-3xl space-y-6 relative overflow-hidden border border-slate-800 shadow-xl">
              <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 opacity-15">
                <Cpu className="w-64 h-64 text-indigo-500" />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
                    Gemini AI Helpdesk Assistant
                  </h3>
                  <p className="text-xs text-slate-400">
                    Analyze description context and verify classification mapping with Google GenAI.
                  </p>
                </div>
                <button
                  onClick={triggerAISuggestions}
                  disabled={aiLoading}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md active:scale-95 transition disabled:opacity-40"
                >
                  {aiLoading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" /> Analyzing feeds...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 text-amber-300" /> Ask Gemini AI
                    </>
                  )}
                </button>
              </div>

              {aiError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-200 text-xs rounded-xl p-4 flex gap-3 items-start relative z-10">
                  <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  <span>{aiError}</span>
                </div>
              )}

              {aiSuggestion && (
                <div className="space-y-6 border-t border-slate-800 pt-6 animate-fade-in relative z-10">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Generated Issue Summary</span>
                    <p className="text-xs text-slate-300 leading-relaxed font-semibold bg-slate-800/50 p-4 rounded-xl border border-slate-800">
                      {aiSuggestion.issueSummary}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Empathetic Resolution Draft</span>
                    <div className="text-xs text-emerald-300 leading-relaxed font-mono bg-slate-800/80 p-5 rounded-xl border border-slate-700/50 whitespace-pre-line">
                      {aiSuggestion.suggestedAction}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Category Integrity Validation</span>
                      <p className="text-xs font-semibold text-slate-300 italic">{aiSuggestion.categoryEvaluation}</p>
                    </div>

                    <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Urgency Priority Validation</span>
                      <p className="text-xs font-semibold text-slate-300 italic">{aiSuggestion.priorityEvaluation}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Comments section */}
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm space-y-6">
            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-600" />
              Ticket Activity Comments ({ticket.comments.length})
            </h3>

            {/* Existing comments */}
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
              {ticket.comments.length === 0 ? (
                <p className="text-gray-400 text-xs py-4 italic text-center">No commentary remarks posted yet for this ticket.</p>
              ) : (
                ticket.comments.map((comment) => {
                  const isAdmin = comment.authorRole === "admin";
                  const isAgent = comment.authorRole === "agent";

                  return (
                    <div key={comment._id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100/50 flex flex-col space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-gray-800">{comment.author}</span>
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            isAdmin ? 'bg-red-50 text-red-700 border border-red-100' :
                            isAgent ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {comment.authorRole}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-400">{new Date(comment.createdAt).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed font-semibold">{comment.text}</p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Input Comment Box */}
            <div className="border-t border-gray-100 pt-6">
              {ticket.status === "Closed" ? (
                <div className="bg-slate-50 border p-4 rounded-xl text-center text-xs text-slate-500 font-bold">
                  🔒 Commenting Blocked: This ticket has been CLOSED.
                </div>
              ) : (
                <form onSubmit={handleAddComment} className="flex gap-3">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Provide troubleshooting details or inquiry remarks..."
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-xs bg-gray-50/50 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                  />
                  <button
                    type="submit"
                    disabled={commentPending}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold flex items-center justify-center transition disabled:opacity-40 shrink-0"
                  >
                    {commentPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* Action Controls Column */}
        <div className="space-y-8">
          {/* SLA Tracking Countdown Widget */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider font-extrabold pb-1">SLA Target Escalation</h3>
            
            <div className={`p-4 rounded-2xl border text-center ${slaStateColor} transition-colors duration-500 space-y-2`}>
              <span className="text-[10px] font-bold tracking-wider uppercase block">Time Remaining to SLA Resolve</span>
              <p className="text-lg font-mono font-black">{timeLeftStr}</p>
            </div>

            <div className="text-xs text-gray-500 space-y-2 border-t border-gray-100 pt-3 font-semibold">
              <div className="flex justify-between">
                <span>Priority SLA Limit:</span>
                <span className="font-bold text-gray-750">
                  {ticket.priority === "Critical" ? "2 Hours" :
                   ticket.priority === "High" ? "8 Hours" :
                   ticket.priority === "Medium" ? "24 Hours" : "72 Hours"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Deadline:</span>
                <span className="font-bold text-gray-750">{new Date(ticket.slaDeadline).toLocaleTimeString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Escalated State:</span>
                <span className="font-bold text-red-650 uppercase">{ticket.priorityBumped ? "Yes (Priority Escalated)" : "No"}</span>
              </div>
            </div>
          </div>

          {/* Admin Configuration Board */}
          {currentUser.role === "admin" && (
            <div className="bg-rose-50/40 border border-rose-200/60 p-6 rounded-3xl space-y-4">
              <h3 className="text-xs font-bold text-rose-900 uppercase tracking-wider font-extrabold pb-1 border-b border-rose-100 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-600" /> Admin Controller Board
              </h3>
              
              <div className="space-y-4">
                {/* Category */}
                <div className="space-y-1">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Ticket Category</span>
                  <select
                    value={adminCategory}
                    onChange={(e) => setAdminCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-205 text-xs font-bold rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="Bug">Bug (System Failure/Glitch)</option>
                    <option value="Feature">Feature Requirement</option>
                    <option value="Billing">Billing & Subscription</option>
                    <option value="Other">Other Enquiry</option>
                  </select>
                </div>

                {/* Priority */}
                <div className="space-y-1">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">SLA Severity Level</span>
                  <select
                    value={adminPriority}
                    onChange={(e) => setAdminPriority(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-205 text-xs font-bold rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="Low">Low Priority (72h SLA)</option>
                    <option value="Medium">Medium Priority (24h SLA)</option>
                    <option value="High">High Priority (8h SLA)</option>
                    <option value="Critical">Critical Priority (2h Lead)</option>
                  </select>
                </div>

                {/* Assigned Agent */}
                <div className="space-y-1">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Assigned Support Specialist</span>
                  <select
                    value={adminAgent || ""}
                    onChange={(e) => setAdminAgent(e.target.value === "" ? null : e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-205 text-xs font-bold rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="">Unassigned (Keep in Queue)</option>
                    <option value="Riya">Riya (Tier 1 Support)</option>
                    <option value="Karan">Karan (Tier 2 Engineer)</option>
                    <option value="Dev">Dev (SRE Lead Operator)</option>
                  </select>
                </div>

                <button
                  onClick={handleAdminUpdate}
                  disabled={adminSaving}
                  className="w-full mt-2 font-bold text-xs px-4 py-2.5 bg-slate-800 hover:bg-slate-900 border text-white rounded-xl transition flex items-center justify-center gap-1.5 shadow-md active:scale-95 disabled:opacity-50"
                >
                  {adminSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>Apply Configurations</>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Action state change transitions */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider font-extrabold pb-1">Workflow Transitions</h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-500">Current Status:</span>
                <span className="font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 border border-indigo-100 rounded-full">{ticket.status}</span>
              </div>

              <div className="flex justify-between items-center text-xs border-t border-gray-100 pt-2 pb-1">
                <span className="text-gray-500">Assigned Agent:</span>
                <span className="font-bold text-slate-700">{ticket.assignedAgent ? `${ticket.assignedAgent}` : "Unassigned (Queued)"}</span>
              </div>

              {ticket.status === "Closed" ? (
                <div className="bg-slate-50 border p-4 rounded-xl text-center text-xs text-slate-500 font-bold">
                  This transaction has achieved its terminal status. No adjustments are permitted.
                </div>
              ) : currentUser.role === "customer" ? (
                // Customer transitions - only closing is allowed
                <div className="space-y-2 border-t border-gray-100 pt-3">
                  <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Customer actions:</span>
                  <button
                    onClick={() => handleTransitionStatus("Closed")}
                    disabled={statusPending}
                    className="w-full text-left font-bold text-xs px-4 py-2.5 bg-red-50 border border-red-200 hover:bg-red-100 hover:text-red-700 text-red-750 rounded-xl transition flex items-center justify-between"
                  >
                    Close My Ticket
                    <span className="text-[10px] text-red-500 font-extrabold uppercase">Terminal</span>
                  </button>
                </div>
              ) : currentUser.role === "agent" ? (
                // Agent transitions
                (() => {
                  const isMyTicket = ticket.assignedAgent === currentUser.agentName;
                  const isQueued = ticket.status === "Queued";

                  if (isQueued) {
                    return (
                      <div className="space-y-2 border-t border-gray-100 pt-3">
                        <span className="text-[10px] text-amber-600 font-extrabold uppercase tracking-wider block">Unassigned Item:</span>
                        <button
                          onClick={() => handleTransitionStatus("Open")}
                          disabled={statusPending}
                          className="w-full text-left font-bold text-xs px-4 py-2 bg-amber-50 border border-amber-200 hover:bg-amber-100 hover:text-amber-800 text-amber-800 rounded-xl transition flex items-center justify-between"
                        >
                          Claim & Open Ticket
                          <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0" />
                        </button>
                      </div>
                    );
                  }

                  if (!isMyTicket) {
                    return (
                      <div className="bg-slate-50 border p-4 rounded-xl text-xs text-slate-400 font-bold leading-relaxed whitespace-pre-wrap">
                        🔒 Read-Only: Claimed by Agent {ticket.assignedAgent}. Only they or an Admin can advance ticket progress.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2 border-t border-gray-100 pt-3">
                      <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Progress Workflow:</span>
                      <div className="flex flex-col gap-2">
                        {legalStatusOptions.map((opt) => (
                          <button
                            key={opt}
                            onClick={() => handleTransitionStatus(opt)}
                            disabled={statusPending}
                            className="w-full text-left font-bold text-xs px-4 py-2.5 bg-gray-50 border border-gray-200 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 text-gray-700 rounded-xl transition flex items-center justify-between"
                          >
                            Move ticket to '{opt}'
                            <CheckCircle2 className="w-4 h-4 text-indigo-650 shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()
              ) : (
                // Admin Transitions
                <div className="space-y-2 border-t border-gray-100 pt-3">
                  <span className="text-[10px] text-rose-500 font-bold uppercase tracking-wider block">Administrative Transitions:</span>
                  <div className="flex flex-col gap-2">
                    {legalStatusOptions.map((opt) => (
                      <button
                        key={opt}
                        onClick={() => handleTransitionStatus(opt)}
                        disabled={statusPending}
                        className="w-full text-left font-bold text-xs px-4 py-2.5 bg-gray-50 border border-gray-200 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 text-gray-700 rounded-xl transition flex items-center justify-between"
                      >
                        Force status to '{opt}'
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* History audit timeline log */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4 font-semibold">
            <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5 font-extrabold">
              <History className="w-4 h-4 text-indigo-600" />
              SLA Audit Trail
            </h3>

            <div className="relative border-l border-gray-100 pl-4 space-y-6 max-h-80 overflow-y-auto">
              {ticket.history.map((log) => (
                <div key={log._id} className="relative space-y-1.5 text-xs">
                  {/* Timeline bullet dot */}
                  <div className="absolute -left-[20px] top-1 w-2.5 h-2.5 rounded-full bg-indigo-500 border-2 border-white shadow" />
                  
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-gray-800">{log.action}</span>
                    <span className="text-[9px] text-gray-400 font-medium whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  
                  <p className="text-[10px] text-gray-550">{log.details}</p>
                  
                  <div className="text-[9px] text-gray-450">
                    By: {log.by}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
