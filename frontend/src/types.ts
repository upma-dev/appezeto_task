export interface Comment {
  _id: string;
  text: string;
  author: string;
  authorRole: string;
  createdAt: string;
}

export interface HistoryEntry {
  _id: string;
  action: string;
  by: string;
  timestamp: string;
  details?: string;
}

export interface Ticket {
  _id: string;
  title: string;
  description: string;
  category: "Bug" | "Feature" | "Billing" | "Other";
  priority: "Low" | "Medium" | "High" | "Critical";
  status: "Queued" | "Open" | "In Progress" | "Resolved" | "Closed";
  version: number;
  assignedAgent: string | null;
  slaDeadline: string;
  priorityBumped: boolean;
  createdByUserId: string;
  createdByUserName: string;
  comments: Comment[];
  history: HistoryEntry[];
  createdAt: string;
  updatedAt: string;
  slaState: "ok" | "at_risk" | "breached";
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "agent" | "customer";
  agentName?: string | null;
}

export interface Stats {
  counts: {
    status: { Queued: number; Open: number; "In Progress": number; Resolved: number; Closed: number };
    priority: { Low: number; Medium: number; High: number; Critical: number };
    category: { Bug: number; Feature: number; Billing: number; Other: number };
  };
  totals: {
    active: number;
    queued: number;
  };
  agents: Array<{
    name: string;
    active: number;
    maxLoad: number;
    utilization: number;
  }>;
}

export interface AISuggestion {
  issueSummary: string;
  suggestedAction: string;
  categoryEvaluation: string;
  priorityEvaluation: string;
}
