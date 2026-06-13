import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, HelpCircle, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";

interface CreateTicketProps {
  token: string;
}

export default function CreateTicket({ token }: CreateTicketProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Bug");
  const [priority, setPriority] = useState("Medium");
  
  // Field-level validations
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [globalSuccess, setGlobalSuccess] = useState<string | null>(null);

  const navigate = useNavigate();

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!title.trim()) {
      newErrors.title = "Please specify a descriptive ticket title.";
    } else if (title.length < 5 || title.length > 100) {
      newErrors.title = "Ticket headings must consist of 5 to 100 characters.";
    }

    if (!description.trim()) {
      newErrors.description = "A thorough description detailing your technical issue is required.";
    } else if (description.length < 20) {
      newErrors.description = "Please expand description to be at least 20 characters of clear explanation.";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGlobalError(null);
    setGlobalSuccess(null);

    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const res = await fetch("/api/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title, description, category, priority })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || "Something went wrong while creating the ticket.");
      }

      const createdTicket = await res.json();
      setGlobalSuccess(`Ticket T-${createdTicket._id.substring(createdTicket._id.length - 4).toUpperCase()} logged successfully! Redirecting you to helpdesk...`);
      
      // Redirect after 1.5 seconds
      setTimeout(() => {
        navigate("/tickets");
      }, 1500);
    } catch (err: any) {
      setGlobalError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto bg-white p-8 rounded-3xl border border-gray-100 shadow-sm animate-fade-in my-6">
      <div className="space-y-2 mb-8">
        <h2 className="text-2xl font-bold text-gray-800">File Support Ticket</h2>
        <p className="text-slate-400 text-sm">
          Provide technical specifics regarding your incident. Tickets are routed dynamically based on active load limits.
        </p>
      </div>

      {globalError && (
        <div className="bg-red-50 border border-red-100 text-red-800 text-xs rounded-xl p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <span>{globalError}</span>
        </div>
      )}

      {globalSuccess && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs rounded-xl p-4 mb-6 flex items-start gap-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <span>{globalSuccess}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
            Ticket Title Summary
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Broken OTP login flow on mobile checkout"
            className={`w-full px-4 py-3 border rounded-xl text-xs bg-gray-50/50 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium ${
              errors.title ? "border-red-300 focus:ring-red-500/20 focus:border-red-500" : "border-gray-200"
            }`}
          />
          {errors.title ? (
            <p className="text-[10px] text-red-500 font-semibold">{errors.title}</p>
          ) : (
            <span className="text-[10px] text-gray-400 font-medium block">
              Character boundaries: 5 to 100 characters. {title.length}/100
            </span>
          )}
        </div>

        {/* Category & Priority Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
              Category Division
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 bg-gray-50/50 text-xs font-semibold rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 select-style"
            >
              <option value="Bug">Bug (System Failure/Glitch)</option>
              <option value="Feature">Feature Requirement</option>
              <option value="Billing">Billing & Subscription</option>
              <option value="Other">Other Enquiry</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
              Service Priority Urgency
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 bg-gray-50/50 text-xs font-semibold rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 select-style"
            >
              <option value="Low">Low - Informational assistance (72h SLA)</option>
              <option value="Medium">Medium - Regular inquiries (24h SLA)</option>
              <option value="High">High - Impairment of modules (8h SLA)</option>
              <option value="Critical">Critical - Production outage (2h Escalation SLA)</option>
            </select>
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-gray-700 uppercase tracking-wider block">
            Details / Steps to reproduce
          </label>
          <textarea
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Introduce comprehensive explanations, log details, or steps to reproduce the incident..."
            className={`w-full px-4 py-3 border rounded-xl text-xs bg-gray-50/50 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium leading-relaxed ${
              errors.description ? "border-red-300 focus:ring-red-500/20 focus:border-red-500" : "border-gray-200"
            }`}
          />
          {errors.description ? (
            <p className="text-[10px] text-red-500 font-semibold">{errors.description}</p>
          ) : (
            <span className="text-[10px] text-gray-400 font-medium block">
              Minimum detailed length: 20 characters. {description.length}/500
            </span>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !!globalSuccess}
          className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Recording technical logs...
            </>
          ) : (
            <>
              File Helpdesk Request
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
