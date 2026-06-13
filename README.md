# 🎫 Helpdesk Support Panel - Setup & Run Guide

A fully functional, production-ready full-stack Helpdesk application built on **React (Vite) + Node.js (Express) + MongoDB (Mongoose)**. The application features automated SLA priority timers, real-time ticket counters, secure role-based access control (RBAC views for Customers, Agents, and Administrators), and responsive analytics dashboards.

Follow this comprehensive guide to configure, launch, and evaluate the application in your local environment.

---

## 📋 Table of Contents
1. [Key Features](#-key-features)
2. [Prerequisites](#-prerequisites)
3. [Local Development Installation](#-local-development-installation)
4. [Environment Variables Configuration](#-environment-variables-configuration)
5. [Running the Application](#-running-the-application)
6. [Production Build & Server Deployment](#-production-build--server-deployment)
7. [🔐 Demo Accounts & Pre-Seeded Dummy Data](#-demo-accounts--pre-seeded-dummy-data)
8. [📂 Project Structural Architecture](#-project-structural-architecture)

---

## ✨ Key Features
* **Role-Based Workflows**: Tailored user dashboards for Customers (file & close tickets), Agents (assign, trace timeline & resolve tickets), and Admins (promote operators & override SLA timings).
* **Automated SLA Tracking**: Dynamic warning systems for ticket durations (Critical, High, Medium, Low) that activate critical visual state colors.
* **Pre-Seeded Sandbox**: Initializes automatically with professional demo accounts and real support tickets out of the box.
* **Modern Stack**: Clean integration of Tailwind CSS, Lucide Icons, Framer Motion transitions, and Recharts metric visualizers.

---

## ⚙️ Prerequisites

Ensure your machine has the following tools installed before beginning setup:
* **Node.js** (v18.0.0 or higher recommended)
* **npm** (Node Package Manager - bundled with Node.js)
* An active internet connection (to connect to the pre-configured cloud MongoDB Atlas cluster)

---

## 🚀 Local Development Installation

### Step 1: Clone or Extract Code
Navigate to the root directory where the files are stored via your terminal:
```bash
cd react-example
```

### Step 2: Install Required NPM Dependencies
To fetch and link all necessary node packages (Express, React, Tailwind CSS, Recharts, Mongoose, and icons), execute:
```bash
npm install
```
*This command creates the `node_modules` directory and downloads all dependencies specified in `package.json`.*

---

## 🔑 Environment Variables Configuration

Create a `.env` file in the main root directory (or rename `.env.example` to `.env`) and configure the following parameters:

```env
# Server Port Configuration
PORT=3000

# MongoDB Connection URL
# (A sandboxed cloud MongoDB cluster is pre-configured and ready for painless evaluator testing.
# Replace with your own connection string if you wish to use a custom cloud or local server.)
MONGODB_URI="mongodb+srv://username:password
@cluster0.frvpn.mongodb.net/helpdesk?retryWrites=true&w=majority"

# Gemini Cloud AI Key (Used for smart SLA priority auto-assessments and routing insights)
GEMINI_API_KEY="YOUR_GEMINI_API_KEY_HERE"

# Local Server URL Access Client
APP_URL="http://localhost:3000"
```

---

## 💻 Running the Application

The application is built around a comprehensive full-stack setup. Starting the development server hosts both the Express API routines and Vite's frontend assets concurrently on a single port.

### 🛠️ Launching in Development Mode
Execute the quick development script:
```bash
npm run dev
```

Once initialized, open your favorite web browser and proceed to:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 📦 Production Build & Server Deployment

To bundle, compile, and run the service under production guidelines (e.g., using optimized static files and compiled standalone JavaScript):

1. **Purge prior builds:**
   ```bash
   npm run clean
   ```

2. **Bundle the Client & Compile TypeScript for Node:**
   This command bundles your client-side React code and transpiles the backend server into a single fast CJS file: `dist/server.cjs`.
   ```bash
   npm run build
   ```

3. **Start the Production Process:**
   ```bash
   npm run start
   ```

---

## 🔐 Demo Accounts & Pre-Seeded Dummy Data

The database has been configured to **automatically seed default profiles and simulated support tickets** the very first time you connect. This eliminates the need to register accounts manually before testing.

### Ready-To-Use Default Profiles:

1. **Administrator Profile (Complete SLA adjustments & team RBAC management):**
   * **Email:** `admin@helpdesk.com`
   * **Password:** `admin123`
   * *Permissions: Elevates/demotes team members, tweaks global response guidelines, and tracks server logs.*

2. **Agent Profile (Active task assignment & technical resolutions):**
   * **Email:** `riya@helpdesk.com`
   * **Password:** `riya123`
   * *Permissions: Claims open customer issues, updates statuses, and adds developer notes.*

3. **Customer Profile (Submits request forms & closes tickets):**
   * **Email:** `customer@helpdesk.com`
   * *Password:* `customer123`
   * *Permissions: Creates new issues, views active personal history, and adds customer comments.*

> 💡 **Bonus Tip:** You can also bypass manual form entry entirely by clicking on the **"Simulator Bypass Rails"** available at the bottom of the sign-in cards!

### Pre-Seeded Test Tickets:
Your dashboard will already be populated with 4 distinct pre-rendered tickets:
* **Google OAuth Loop Issue** (Critical category, assigned to Dev, breached SLA example with realistic history log)
* **Stripe Platform Integration** (High category, assigned to Karan, in-progress state)
* **Invoice Record Discrepancy** (Medium category, assigned to Riya, resolved state)
* **Custom Enterprise Support SLA Inquiry** (Low class, queued state, awaiting assignment)

---

## 📂 Project Structural Architecture

The code conforms strictly to the separation of concerns, organized into clean folders:

```text
root/
├── frontend/                # Separated React + Vite client sub-project
│   ├── src/
│   │   ├── components/      # React views (Dashboard, TicketList, AdminPanel, CreateTicket, Detail, AuthSwitcher)
│   │   ├── App.tsx          # Main Client entry and navigation
│   │   ├── main.tsx         # Root bootstrapper
│   │   ├── types.ts         # Central TypeScript interfaces
│   │   └── index.css        # Tailwind input stylesheet
│   ├── public/              # Public asset pool
│   ├── package.json         # Client library configs
│   └── vite.config.ts       # Client Vite configuration pipeline
│
├── backend/                 # Separated Express + Node API sub-project
│   ├── src/
│   │   ├── controllers/     # Controller handlers (optional, bound in routes)
│   │   ├── routes/          # REST Endpoint Routers (auth.ts, tickets.ts)
│   │   ├── models/          # Database Schema Schematics (User.ts, Ticket.ts)
│   │   ├── middleware/      # JWT authentication and RBAC checks (auth.ts)
│   │   ├── utils/           # Assignment algorithms and SLA checks (helpers.ts)
│   │   └── server.ts        # Dedicated Express backend server entry
│   ├── package.json         # API server configuration
│   └── .env.example         # System variables layout
│
├── README.md                # System run guide documents
└── server.ts                # Master root full-stack orchestrator
```
