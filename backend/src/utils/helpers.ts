import { Ticket } from "../models/Ticket.js";

// SLA Durations in milliseconds
export const SLA_DURATIONS: Record<string, number> = {
  Critical: 2 * 60 * 60 * 1000,   // 2 hours
  High: 8 * 60 * 60 * 1000,       // 8 hours
  Medium: 24 * 60 * 60 * 1000,    // 24 hours
  Low: 72 * 60 * 60 * 1000        // 72 hours
};

// Priority escalation chain
export const PRIORITY_UPGRADE: Record<string, string> = {
  Low: "Medium",
  Medium: "High",
  High: "Critical",
  Critical: "Critical"
};

/**
 * Calculates current SLA state, bumps priority if breached and active.
 * Persists changes if any edits occur.
 */
export async function checkAndProcessSLA(ticket: any): Promise<{ slaState: "ok" | "at_risk" | "breached"; wasBumped: boolean }> {
  if (ticket.status === "Resolved" || ticket.status === "Closed") {
    return { slaState: "ok", wasBumped: false };
  }

  const now = Date.now();
  const createdAt = new Date(ticket.createdAt).getTime();
  const deadline = new Date(ticket.slaDeadline).getTime();
  const duration = deadline - createdAt;
  const elapsed = now - createdAt;
  const ratio = duration > 0 ? elapsed / duration : 0;

  let slaState: "ok" | "at_risk" | "breached" = "ok";
  let wasBumped = false;

  if (now >= deadline) {
    slaState = "breached";
    // Check if still Open or In Progress and can be bumped
    if ((ticket.status === "Open" || ticket.status === "In Progress") && !ticket.priorityBumped && ticket.priority !== "Critical") {
      const oldPriority = ticket.priority;
      const newPriority = PRIORITY_UPGRADE[oldPriority];
      
      if (newPriority && newPriority !== oldPriority) {
        ticket.priority = newPriority;
        ticket.priorityBumped = true;
        // Adjust deadline for new priority
        const newDuration = SLA_DURATIONS[newPriority];
        ticket.slaDeadline = new Date(createdAt + newDuration);
        ticket.history.push({
          action: "SLA Breach Escalation",
          by: "System",
          timestamp: new Date(),
          details: `SLA breached. Priority automatically escalated from ${oldPriority} to ${newPriority}.`
        });
        ticket.version += 1;
        await ticket.save();
        wasBumped = true;
      }
    }
  } else if (ratio >= 0.75) {
    slaState = "at_risk";
  }

  return { slaState, wasBumped };
}

/**
 * Assigns a new ticket to an agent based on load balancing rules.
 * Handled status is either "Open" or "Queued" depending on load.
 */
export async function determineAssignmentAndStatus(): Promise<{ assignedAgent: string | null; status: "Open" | "Queued" }> {
  // Query all active tickets
  const activeTickets = await Ticket.find({ status: { $in: ["Open", "In Progress"] } });
  
  const counts: Record<string, number> = { "Riya": 0, "Karan": 0, "Dev": 0 };
  activeTickets.forEach((t) => {
    if (t.assignedAgent && counts[t.assignedAgent] !== undefined) {
      counts[t.assignedAgent]++;
    }
  });

  const agents = [
    { name: "Dev", maxLoad: 5 },
    { name: "Karan", maxLoad: 4 },
    { name: "Riya", maxLoad: 3 }
  ];

  const agentLoads = agents.map((agent) => {
    const activeCount = counts[agent.name] || 0;
    const loadPercent = activeCount / agent.maxLoad;
    return { name: agent.name, maxLoad: agent.maxLoad, activeCount, loadPercent };
  });

  // Check if all agents are fully loaded
  const allFull = agentLoads.every((al) => al.activeCount >= al.maxLoad);
  if (allFull) {
    return { assignedAgent: null, status: "Queued" };
  }

  // Sort according to instructions:
  // 1. Lowest load percentage (active tickets / maxLoad)
  // 2. Ties broken by fewest absolute active tickets
  // 3. Ties broken by alphabetical order
  agentLoads.sort((a, b) => {
    if (a.loadPercent !== b.loadPercent) {
      return a.loadPercent - b.loadPercent;
    }
    if (a.activeCount !== b.activeCount) {
      return a.activeCount - b.activeCount;
    }
    return a.name.localeCompare(b.name);
  });

  return { assignedAgent: agentLoads[0].name, status: "Open" };
}

/**
 * Checks for oldest Queued ticket and autoassigns it to the recently freed agent if possible.
 */
export async function assignOldestQueuedTicket(freedAgentName: string): Promise<boolean> {
  const oldestQueued = await Ticket.findOne({ status: "Queued" }).sort({ createdAt: 1 });
  if (!oldestQueued) {
    return false;
  }

  // Double check that agent has slots open
  const activeTicketsCount = await Ticket.countDocuments({
    status: { $in: ["Open", "In Progress"] },
    assignedAgent: freedAgentName
  });

  const maxLoadMap: Record<string, number> = { "Riya": 3, "Karan": 4, "Dev": 5 };
  const maxLoad = maxLoadMap[freedAgentName] || 5;

  if (activeTicketsCount < maxLoad) {
    oldestQueued.assignedAgent = freedAgentName;
    oldestQueued.status = "Open";
    oldestQueued.history.push({
      action: "Auto-Assigned from Queue",
      by: "System",
      timestamp: new Date(),
      details: `Ticket pulled from queue and auto-assigned to ${freedAgentName} who was recently freed.`
    });
    oldestQueued.version += 1;
    await oldestQueued.save();
    return true;
  }

  return false;
}
