import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import bcrypt from "bcryptjs";

// Load models
import { User } from "./models/User.js";
import { Ticket } from "./models/Ticket.js";

// Load routes
import authRouter from "./routes/auth.js";
import ticketRouter from "./routes/tickets.js";

dotenv.config();
// Additionally try loading from the backend directory to be safe in monorepo/flat folder development
dotenv.config({ path: path.join(process.cwd(), "backend", ".env") });
dotenv.config({ path: path.join(process.cwd(), ".env") });

const app = express();
const PORT = process.env.PORT || 3000;

// Sanitize MONGODB_URI to remove potential outer quotes, whitespace or trailing semicolons
let envMongoURI = process.env.MONGODB_URI;
if (envMongoURI) {
  envMongoURI = envMongoURI.trim();
  // Strip starting/ending quotes if they exist
  envMongoURI = envMongoURI.replace(/^["']|["']$/g, "").trim();
  // Strip trailing semicolons if they exist
  envMongoURI = envMongoURI.replace(/;+$/, "").trim();
}

const MONGODB_URI = envMongoURI || "";

// Enable CORS & Body Parsing
app.use(cors());
app.use(express.json());

// API Routes
app.use("/api/auth", authRouter);
app.use("/api/tickets", ticketRouter);

// Database connection & seeding helper
async function initializeDatabase() {
  try {
    if (!MONGODB_URI) {
      throw new Error("MONGODB_URI environment variable is missing or empty. Please specify it in your .env file.");
    }

    if (!MONGODB_URI.startsWith("mongodb://") && !MONGODB_URI.startsWith("mongodb+srv://")) {
      throw new Error("Invalid MONGODB_URI scheme, expected connection string to start with 'mongodb://' or 'mongodb+srv://'.");
    }

    console.log("Connecting to MongoDB using secure environment variable...");
    await mongoose.connect(MONGODB_URI);
    console.log("MongoDB connection verified successfully.");

    // Seed default users if none exist to make evaluation painless
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log("Seeding default demonstration users...");

      const salt = await bcrypt.genSalt(10);
      const hashPassword = async (pass: string) => {
        return bcrypt.hash(pass, salt);
      };

      const seedUsers: any[] = [
        {
          name: "Manager Admin",
          email: "admin@helpdesk.com",
          password: await hashPassword("admin123"),
          role: "admin",
          agentName: null
        },
        {
          name: "Riya (Agent)",
          email: "riya@helpdesk.com",
          password: await hashPassword("riya123"),
          role: "agent",
          agentName: "Riya"
        },
        {
          name: "Karan (Agent)",
          email: "karan@helpdesk.com",
          password: await hashPassword("karan123"),
          role: "agent",
          agentName: "Karan"
        },
        {
          name: "Dev (Agent)",
          email: "dev@helpdesk.com",
          password: await hashPassword("dev123"),
          role: "agent",
          agentName: "Dev"
        },
        {
          name: "Somi Mishra",
          email: "customer@helpdesk.com",
          password: await hashPassword("customer123"),
          role: "customer",
          agentName: null
        }
      ];

      await User.insertMany(seedUsers);
      console.log("Demonstration users seeded successfully.");
    }

    // Seed default tickets if none exist
    const ticketCount = await Ticket.countDocuments();
    if (ticketCount === 0) {
      console.log("Seeding default support tickets...");
      
      const customer = await User.findOne({ email: "customer@helpdesk.com" });
      const customerId = customer ? customer._id.toString() : new mongoose.Types.ObjectId().toString();
      const customerName = customer ? customer.name : "Somi Mishra";

      const defaultTickets = [
        {
          title: "Production Login Loop Error with Google OAuth",
          description: "Users are experiencing a continuous redirect loop when trying to authenticate with Google accounts in production. Clearing cookies does not resolve this, and it is locking out users.",
          category: "Bug",
          priority: "Critical",
          status: "Open",
          assignedAgent: "Dev",
          slaDeadline: new Date(Date.now() - 45 * 60 * 1000), // 45 mins ago (Already Breached SLA)
          createdByUserId: customerId,
          createdByUserName: customerName,
          comments: [
            {
              text: "Investigating the callback controller. It looks like the session tokens are not persisting in Redis properly.",
              author: "Dev",
              authorRole: "agent",
              createdAt: new Date(Date.now() - 30 * 60 * 1000)
            }
          ],
          history: [
            {
              action: "Ticket Created",
              by: customerName,
              timestamp: new Date(Date.now() - 50 * 60 * 1000),
              details: "Initial submission via portal."
            },
            {
              action: "Assigned Agent",
              by: "System Router",
              timestamp: new Date(Date.now() - 48 * 60 * 1000),
              details: "Auto-routed to Dev based on SRE availability."
            }
          ]
        },
        {
          title: "Implement Stripe payment gateway on pricing checkout",
          description: "Our enterprise customers would like to purchase annual subscriptions directly via credit card. We need a secure checkout page integrating standard Stripe elements.",
          category: "Feature",
          priority: "High",
          status: "In Progress",
          assignedAgent: "Karan",
          slaDeadline: new Date(Date.now() + 3 * 60 * 60 * 1000), // 3 hours from now
          createdByUserId: customerId,
          createdByUserName: customerName,
          comments: [
            {
              text: "Frontend boilerplate UI is done. Working on configuring Stripe webhooks on the backend.",
              author: "Karan",
              authorRole: "agent",
              createdAt: new Date(Date.now() - 10 * 60 * 1000)
            }
          ],
          history: [
            {
              action: "Ticket Created",
              by: customerName,
              timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000),
              details: "Created high priority request."
            },
            {
              action: "Status Update",
              by: "Karan",
              timestamp: new Date(Date.now() - 20 * 60 * 1000),
              details: "Status shifted to In Progress."
            }
          ]
        },
        {
          title: "Duplicate invoice records generated on enterprise download portal",
          description: "When downloading combined invoice tables for annual audits, the same transactions are showing up twice, leading to incorrect calculations and balance sheets.",
          category: "Billing",
          priority: "Medium",
          status: "Resolved",
          assignedAgent: "Riya",
          slaDeadline: new Date(Date.now() + 4 * 60 * 60 * 1000), // 4 hours from now
          createdByUserId: customerId,
          createdByUserName: customerName,
          comments: [
            {
              text: "Fixed a SQL join error that was duplicating entries. Recompiled PDF generation nodes successfully.",
              author: "Riya",
              authorRole: "agent",
              createdAt: new Date(Date.now() - 15 * 60 * 1000)
            }
          ],
          history: [
            {
              action: "Ticket Created",
              by: customerName,
              timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
              details: "Created billing help ticket."
            },
            {
              action: "Status Update",
              by: "Riya",
              timestamp: new Date(Date.now() - 15 * 60 * 1000),
              details: "Status marked as Resolved."
            }
          ]
        },
        {
          title: "Inquire about customized enterprise volume SLA policies",
          description: "Our accounting team is requesting a custom support tier with less than 15-minute response times for core API endpoint failures. Please share contact details.",
          category: "Other",
          priority: "Low",
          status: "Queued",
          assignedAgent: null,
          slaDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
          createdByUserId: customerId,
          createdByUserName: customerName,
          comments: [],
          history: [
            {
              action: "Ticket Created",
              by: customerName,
              timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000),
              details: "Inquiry submitted."
            }
          ]
        }
      ];

      await Ticket.insertMany(defaultTickets);
      console.log("Demonstration tickets seeded successfully.");
    }
  } catch (err) {
    console.error("MongoDB connection or seeding failure:", err);
  }
}

async function startServer() {
  await initializeDatabase();

  // Attach Vite development server or production static serving
  if (process.env.NODE_ENV !== "production") {
    console.log("Booting Vite development server middleware with separate root index...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
      root: path.join(process.cwd(), "frontend") // Look inside /frontend directory
    });
    app.use(vite.middlewares);
  } else {
    console.log("Running in Production. Serving static built assets...");
    const distPath = path.join(process.cwd(), "frontend/dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`=========================================`);
    console.log(`Server successfully started on port ${PORT}`);
    console.log(`Service URL: http://0.0.0.0:${PORT}`);
    console.log(`=========================================`);
  });
}

startServer();
