import express from "express";
import { Ticket } from "../models/Ticket.js";
import { User } from "../models/User.js";
import { authenticateToken, AuthenticatedRequest } from "../middleware/auth.js";
import {
  checkAndProcessSLA,
  determineAssignmentAndStatus,
  assignOldestQueuedTicket,
  SLA_DURATIONS
} from "../utils/helpers.js";
import { GoogleGenAI } from "@google/genai";

const router = express.Router();

// Initialize GoogleGenAI for our AI Assistant feature
let aiClient: GoogleGenAI | null = null;
function getGenAI() {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY environment variable is missing. AI functionality will be disabled.");
      return null;
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiClient;
}

// 1. Get Tickets Stats (Single Aggregation Pipeline)
router.get("/stats", authenticateToken as any, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    // We can also trigger priority bumps on all active tickets before loading stats to ensure SLA counts are exact!
    const activeTickets = await Ticket.find({ status: { $in: ["Open", "In Progress"] } });
    for (const t of activeTickets) {
      await checkAndProcessSLA(t);
    }

    // Role-based filtering for stats:
    // Customers only see stats of their own tickets
    // Agents see stats of their assigned tickets
    // Admins see all
    let matchStage: any = {};
    if (req.user?.role === "customer") {
      matchStage = { createdByUserId: req.user.id };
    } else if (req.user?.role === "agent") {
      // Show assigned agents stats or all? Let's show all for agents so they see the entire company's load, but filter lists
      matchStage = {};
    }

    const rawStats = await Ticket.aggregate([
      ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),
      {
        $facet: {
          byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
          byPriority: [{ $group: { _id: "$priority", count: { $sum: 1 } } }],
          byCategory: [{ $group: { _id: "$category", count: { $sum: 1 } } }]
        }
      }
    ]);

    const result = {
      status: { Queued: 0, Open: 0, "In Progress": 0, Resolved: 0, Closed: 0 },
      priority: { Low: 0, Medium: 0, High: 0, Critical: 0 },
      category: { Bug: 0, Feature: 0, Billing: 0, Other: 0 }
    };

    if (rawStats && rawStats[0]) {
      rawStats[0].byStatus.forEach((item: any) => {
        if (item._id && (result.status as any)[item._id] !== undefined) {
          (result.status as any)[item._id] = item.count;
        }
      });
      rawStats[0].byPriority.forEach((item: any) => {
        if (item._id && (result.priority as any)[item._id] !== undefined) {
          (result.priority as any)[item._id] = item.count;
        }
      });
      rawStats[0].byCategory.forEach((item: any) => {
        if (item._id && (result.category as any)[item._id] !== undefined) {
          (result.category as any)[item._id] = item.count;
        }
      });
    }

    // Include operational metrics (agent load & queue sizes)
    const activeTicketsCount = await Ticket.countDocuments({ status: { $in: ["Open", "In Progress"] } });
    const queuedCount = await Ticket.countDocuments({ status: "Queued" });

    // Agent Details & active tickets
    const agents = ["Riya", "Karan", "Dev"];
    const agentMetrics = [];
    for (const name of agents) {
      const activeCount = await Ticket.countDocuments({
        status: { $in: ["Open", "In Progress"] },
        assignedAgent: name
      });
      const maxLoads: Record<string, number> = { "Riya": 3, "Karan": 4, "Dev": 5 };
      const maxLoad = maxLoads[name];
      agentMetrics.push({
        name,
        active: activeCount,
        maxLoad,
        utilization: Math.round((activeCount / maxLoad) * 100)
      });
    }

    res.json({
      counts: result,
      totals: { active: activeTicketsCount, queued: queuedCount },
      agents: agentMetrics
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// 2. Create Ticket
router.post("/", authenticateToken as any, async (req: AuthenticatedRequest, res): Promise<any> => {
  const { title, description, category, priority } = req.body;

  // Validation
  if (!title || title.length < 5 || title.length > 100) {
    return res.status(400).json({ message: "Title must be between 5 and 100 characters." });
  }
  if (!description || description.length < 20) {
    return res.status(400).json({ message: "Description must be at least 20 characters." });
  }
  if (!["Bug", "Feature", "Billing", "Other"].includes(category)) {
    return res.status(400).json({ message: "Invalid category selected." });
  }
  if (!["Low", "Medium", "High", "Critical"].includes(priority)) {
    return res.status(400).json({ message: "Invalid priority selected." });
  }

  try {
    // 1. Determine assignment and status using load balancing
    const { assignedAgent, status } = await determineAssignmentAndStatus();

    // 2. Calculate SLA deadline: createdAt + priority duration
    const createdAt = new Date();
    const duration = SLA_DURATIONS[priority] || SLA_DURATIONS.Medium;
    const slaDeadline = new Date(createdAt.getTime() + duration);

    const ticket = new Ticket({
      title,
      description,
      category,
      priority,
      status,
      assignedAgent,
      slaDeadline,
      createdByUserId: req.user?.id,
      createdByUserName: req.user?.name || "Customer",
      version: 1,
      history: [
        {
          action: "Created",
          by: req.user?.name || "System",
          timestamp: createdAt,
          details: `Ticket successfully filed. ${
            assignedAgent
              ? `Auto-routed to Agent ${assignedAgent} (load-balanced)`
              : "All system agents are currently at peak load. Ticket queued in backlog."
          }`
        }
      ]
    });

    await ticket.save();
    res.status(201).json(ticket);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// 3. List Tickets
router.get("/", authenticateToken as any, async (req: AuthenticatedRequest, res): Promise<any> => {
  const { status, priority, search, sort = "newest", page = "1", limit = "6" } = req.query;

  try {
    // Trigger SLA priority bumps for all active items on read
    const activeTickets = await Ticket.find({ status: { $in: ["Open", "In Progress"] } });
    for (const t of activeTickets) {
      await checkAndProcessSLA(t);
    }

    // Build filter query
    const filterQuery: any = {};

    // Apply RBAC limits
    if (req.user?.role === "customer") {
      // Customers can only see their own tickets
      filterQuery.createdByUserId = req.user.id;
    } else if (req.user?.role === "agent") {
      // Agents see tickets assigned to them OR queued tickets (so they can pick them up when freed)
      filterQuery.$or = [
        { assignedAgent: req.user.agentName },
        { status: "Queued" }
      ];
    }

    // Apply User Search & Filters
    if (status) {
      filterQuery.status = status;
    }
    if (priority) {
      filterQuery.priority = priority;
    }
    if (search) {
      const searchRegex = new RegExp(String(search), "i");
      filterQuery.$and = filterQuery.$and || [];
      filterQuery.$and.push({
        $or: [{ title: searchRegex }, { description: searchRegex }]
      });
    }

    // Parse pagination params
    const parsedPage = Math.max(1, parseInt(String(page)) || 1);
    const parsedLimit = Math.max(1, parseInt(String(limit)) || 6);
    const skip = (parsedPage - 1) * parsedLimit;

    // Define Sorting
    let sortQuery: any = {};
    if (sort === "newest") {
      sortQuery = { createdAt: -1 };
    } else if (sort === "oldest") {
      sortQuery = { createdAt: 1 };
    }

    let tickets;
    let totalCount;

    if (sort === "priority") {
      // Fetch all matching filter results to sort correctly
      const allMatches = await Ticket.find(filterQuery);
      
      const priorityWeights: Record<string, number> = { Critical: 4, High: 3, Medium: 2, Low: 1 };
      allMatches.sort((a, b) => {
        const weightA = priorityWeights[a.priority] || 1;
        const weightB = priorityWeights[b.priority] || 1;
        if (weightA !== weightB) {
          return weightB - weightA; // Descending
        }
        return b.createdAt.getTime() - a.createdAt.getTime(); // Secondary sort: newest
      });

      totalCount = allMatches.length;
      tickets = allMatches.slice(skip, skip + parsedLimit);
    } else {
      totalCount = await Ticket.countDocuments(filterQuery);
      tickets = await Ticket.find(filterQuery)
        .sort(sortQuery)
        .skip(skip)
        .limit(parsedLimit);
    }

    // Derive SLA states before sending
    const ticketsWithSLAState = await Promise.all(
      tickets.map(async (ticketDoc) => {
        const obj = ticketDoc.toObject();
        // Compute current SLA state for output
        const now = Date.now();
        const createdAt = new Date(obj.createdAt).getTime();
        const deadline = new Date(obj.slaDeadline).getTime();
        const duration = deadline - createdAt;
        const elapsed = now - createdAt;
        const ratio = duration > 0 ? elapsed / duration : 0;

        let derivedSla: "ok" | "at_risk" | "breached" = "ok";
        if (obj.status === "Resolved" || obj.status === "Closed") {
          derivedSla = "ok";
        } else if (now >= deadline) {
          derivedSla = "breached";
        } else if (ratio >= 0.75) {
          derivedSla = "at_risk";
        }

        return { ...obj, slaState: derivedSla };
      })
    );

    res.json({
      tickets: ticketsWithSLAState,
      totalCount,
      totalPages: Math.ceil(totalCount / parsedLimit),
      currentPage: parsedPage
    });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// 4. Fetch Single Ticket
router.get("/:id", authenticateToken as any, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found." });
    }

    // SLA check
    const { slaState } = await checkAndProcessSLA(ticket);

    // Apply RBAC privacy filter
    if (req.user?.role === "customer" && ticket.createdByUserId !== req.user.id) {
      return res.status(403).json({ message: "Access denied." });
    }

    res.json({ ...ticket.toObject(), slaState });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// 5. Update Ticket (Status transitions, Optimistic locking, Auto-Queuing)
router.patch("/:id", authenticateToken as any, async (req: AuthenticatedRequest, res): Promise<any> => {
  const { status: newStatus, priority: newPriority, category: newCategory, version: clientVersion } = req.body;

  if (clientVersion === undefined) {
    return res.status(400).json({ message: "Missing ticket version for optimistic locking safety." });
  }

  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found." });
    }

    // 0. ROLE-BASED ACCESS CONTROL (RBAC) VERIFICATION
    if (req.user?.role === "customer") {
      // Customers can only edit their own tickets
      if (ticket.createdByUserId !== req.user.id) {
        return res.status(403).json({ message: "Access Denied: You cannot edit tickets filed by other users." });
      }
      // Customers are not allowed to change priority, category, or assignments
      if (newPriority || newCategory || (req.body.assignedAgent !== undefined && req.body.assignedAgent !== ticket.assignedAgent)) {
        return res.status(403).json({ message: "Access Denied: Customers are not permitted to amend category, priority, or agent assignments." });
      }
      // Customers can only close their tickets
      if (newStatus && newStatus !== "Closed") {
        return res.status(403).json({ message: "Access Denied: Customers are only allowed to advance status to Closed." });
      }
    } else if (req.user?.role === "agent") {
      // Agents can edit:
      // - Tickets assigned to them
      // - Queued tickets (only to claim them)
      const isAssignedToMe = ticket.assignedAgent === req.user.agentName;
      const isClaimingQueue = ticket.status === "Queued" && newStatus === "Open";

      if (!isAssignedToMe && !isClaimingQueue) {
        return res.status(403).json({ message: "Access Denied: Agents can only update tickets assigned to them or claim queued tickets." });
      }

      // If an agent is claiming a queued ticket, force transition and automatic self-assignment
      if (isClaimingQueue) {
        req.body.assignedAgent = req.user.agentName;
      }

      // Agents cannot reassign a ticket to someone else
      if (req.body.assignedAgent !== undefined && req.body.assignedAgent !== ticket.assignedAgent && req.body.assignedAgent !== req.user.agentName) {
        return res.status(403).json({ message: "Access Denied: Agents are not allowed to reassign tickets to other specialists." });
      }
    }

    // 1. OPTIMISTIC LOCKING VERIFICATION
    if (ticket.version !== Number(clientVersion)) {
      const { slaState } = await checkAndProcessSLA(ticket);
      return res.status(409).json({
        message: "Conflict: This ticket has already been updated by another session. Please fetch the latest changes.",
        ticket: { ...ticket.toObject(), slaState }
      });
    }

    const oldStatus = ticket.status;
    const oldAgent = ticket.assignedAgent;

    // 2. STATUS STATE MACHINE VALIDATION
    if (newStatus && newStatus !== oldStatus) {
      // Validate terminal closed state
      if (oldStatus === "Closed") {
        return res.status(400).json({ message: "State error: A closed ticket cannot be reopened or edited." });
      }

      // Allowed State transitions
      let valid = false;
      if (oldStatus === "Queued") {
        // Pulled from Queue directly
        valid = ["Open", "Closed"].includes(newStatus);
      } else if (oldStatus === "Open") {
        valid = ["In Progress", "Closed"].includes(newStatus);
      } else if (oldStatus === "In Progress") {
        valid = ["Resolved", "Closed"].includes(newStatus);
      } else if (oldStatus === "Resolved") {
        valid = ["In Progress", "Closed"].includes(newStatus);
      }

      if (!valid) {
        return res.status(400).json({
          message: `Illegal Status Transition: Cannot move ticket directly from '${oldStatus}' to '${newStatus}'.`
        });
      }

      ticket.status = newStatus;
      ticket.history.push({
        action: "Status Changed",
        by: req.user?.name || "System",
        timestamp: new Date(),
        details: `Moved from status '${oldStatus}' to '${newStatus}'`
      });
    }

    // Optional updates
    if (newPriority && newPriority !== ticket.priority) {
      const oldPri = ticket.priority;
      ticket.priority = newPriority;
      // Recalculate deadline
      const createdAt = new Date(ticket.createdAt);
      const duration = SLA_DURATIONS[newPriority] || SLA_DURATIONS.Medium;
      ticket.slaDeadline = new Date(createdAt.getTime() + duration);
      
      ticket.history.push({
        action: "Priority Changed",
        by: req.user?.name || "System",
        timestamp: new Date(),
        details: `Updated priority from '${oldPri}' to '${newPriority}'. Target SLA deadline recalculated.`
      });
    }

    if (newCategory) {
      ticket.category = newCategory;
    }

    // Assignment updates by Admin (or automated claim)
    const newAssignedAgent = req.body.assignedAgent;
    if (newAssignedAgent !== undefined && newAssignedAgent !== ticket.assignedAgent) {
      const oldAssigned = ticket.assignedAgent || "Unassigned";
      const displayAssigned = newAssignedAgent === null ? "None" : newAssignedAgent;
      ticket.assignedAgent = newAssignedAgent;
      ticket.history.push({
        action: "Agent Assigned",
        by: req.user?.name || "System",
        timestamp: new Date(),
        details: `Reassigned ticket specialist from '${oldAssigned}' to '${displayAssigned}'.`
      });
    }

    // Increment version
    ticket.version += 1;
    await ticket.save();

    // 3. AUTO-QUEUE REASSIGNMENT TRIGGER
    // If ticket becomes Resolved or Closed, we can immediately pull the oldest queued ticket to the newly freed agent!
    if (
      (newStatus === "Resolved" || newStatus === "Closed") &&
      (oldStatus === "Open" || oldStatus === "In Progress") &&
      oldAgent
    ) {
      await assignOldestQueuedTicket(oldAgent);
    }

    const { slaState } = await checkAndProcessSLA(ticket);
    res.json({ ...ticket.toObject(), slaState });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// 6. Post Comments
router.post("/:id/comments", authenticateToken as any, async (req: AuthenticatedRequest, res): Promise<any> => {
  const { text } = req.body;

  if (!text || text.trim().length < 3) {
    return res.status(400).json({ message: "Comment draft must be at least 3 characters." });
  }

  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found." });
    }

    // Role-based privacy restriction for commenting
    if (req.user?.role === "customer" && ticket.createdByUserId !== req.user.id) {
      return res.status(403).json({ message: "Access Denied: Customers can only comment on their own tickets." });
    }

    // Reject comments on closed tickets
    if (ticket.status === "Closed") {
      return res.status(400).json({ message: "Commenting Blocked: This ticket has been closed." });
    }

    ticket.comments.push({
      text,
      author: req.user?.name || "Anonymous",
      authorRole: req.user?.role || "customer",
      createdAt: new Date()
    });

    ticket.history.push({
      action: "Comment Posted",
      by: req.user?.name || "System",
      timestamp: new Date(),
      details: "Added explanation remarks"
    });

    ticket.version += 1;
    await ticket.save();

    const { slaState } = await checkAndProcessSLA(ticket);
    res.json({ ...ticket.toObject(), slaState });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// 7. Core AI Assistant (Gemini API Integration) - Interview select feature
router.post("/:id/ai-suggest", authenticateToken as any, async (req: AuthenticatedRequest, res): Promise<any> => {
  try {
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) {
      return res.status(404).json({ message: "Ticket not found." });
    }

    // Only allow Agents and Admins to trigger Gemini AI predictions
    if (req.user?.role === "customer") {
      return res.status(403).json({ message: "Access Denied: AI helpdesk diagnostics are only accessible to support agents and admins." });
    }

    const genAIObj = getGenAI();
    if (!genAIObj) {
      return res.status(503).json({
        message: "Gemini AI Engine is currently unconfigured because GEMINI_API_KEY is not set."
      });
    }

    const prompt = `You are an expert, empathetic Helpdesk Senior Technician.
Analyze this ticket and suggest a professional response, categorizing accuracy, and direct troubleshooting recommendations.

TICKET SUMMARY:
- Title: ${ticket.title}
- Category: ${ticket.category}
- Priority: ${ticket.priority}
- Current Status: ${ticket.status}
- Description: ${ticket.description}
${
  ticket.comments.length
    ? `- Ticket Discussions:\n${ticket.comments.map((c: any) => `  * [${c.authorRole}] ${c.author}: ${c.text}`).join("\n")}`
    : ""
}

Write a detailed response structured as a JSON object with these keys:
- "issueSummary" (Short 2-sentence breakdown of what Went wrong)
- "suggestedAction" (Comprehensive, step-by-step resolution draft ready to send to the customer)
- "categoryEvaluation" (Your opinion: is the current category '${ticket.category}' correct? If not, state what it should be)
- "priorityEvaluation" (Your assessment: is '${ticket.priority}' appropriate given the ticket criticality?)

Return ONLY the raw JSON object. Do not format with markdown block tags (like \`\`\`json).`;

    const response = await genAIObj.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const aiText = response.text || "{}";
    const suggestionInfo = JSON.parse(aiText.trim());

    res.json({
      ticketId: ticket._id,
      aiAnalysis: suggestionInfo
    });
  } catch (err: any) {
    res.status(500).json({ message: "AI generation failed: " + err.message });
  }
});

export default router;
