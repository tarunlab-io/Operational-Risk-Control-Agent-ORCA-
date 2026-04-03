# 🚀 ORCA — Operational Risk Control Agent

ORCA (Operational Risk Control Agent) is an AI-powered civic intelligence system designed to identify, 
classify, and escalate urban issues in real-time. It transforms unstructured user complaints into 
actionable insights, enabling faster response from authorities and improving public safety.

---

## 🧠 Problem Statement

Urban environments constantly face issues like:

* Garbage overflow
* Water leakage
* Road damage
* Power failures
* Public safety hazards

These problems are often:

* Reported manually
* Poorly categorized
* Delayed in resolution

There is no intelligent system that can:

* Understand complaints automatically
* Assign them to the correct department
* Evaluate urgency and risk

---

## 💡 Solution

ORCA solves this by acting as an **autonomous AI agent** that:

1. Accepts user complaints (text + optional image)
2. Uses AI to analyze and classify the issue
3. Determines:

   * Issue type
   * Risk level
   * Priority
   * Responsible department
4. Automatically generates and sends structured emails to authorities
5. Tracks complaint status and updates it based on responses

---

## ⚙️ How It Works

### 🧾 Input Layer

Users submit:

* A description of the issue
* Optional image for better context

---

### 🤖 AI Processing Layer

* Uses NVIDIA LLaMA-based models
* Converts natural language → structured JSON
* Classifies:

  * Risk (LOW → CRITICAL)
  * Department
  * Priority

---

### 📤 Action Layer

* Automatically generates formal complaint emails
* Sends them to relevant authorities using Nodemailer

---

### 🗄️ Data Layer

* Firebase Firestore stores:

  * Complaints
  * Status updates
  * Metadata

---

### 🔄 Feedback Loop

* Incoming email replies are analyzed
* AI updates complaint status:

  * SENT
  * WORKING
  * RESOLVED

---

## 🏗️ Tech Stack

### Frontend

* React (Vite)
* Modern UI with glassmorphism & animations
* Deployed on Vercel

### Backend

* Node.js + Express
* REST API architecture
* Deployed on Render

### AI Layer

* NVIDIA LLaMA API
* Prompt-engineered structured output

### Database

* Firebase Firestore

### Communication

* Nodemailer (Automated Email System)

---

## ✨ Key Features

* ⚡ Real-time AI-powered classification
* 📊 Risk-based prioritization system
* 📩 Automated email escalation
* 🔄 Status tracking via AI
* 🧠 Agentic decision-making (not rule-based)
* 🎨 Premium UI with interactive dashboards

---

## 🧪 Example Workflow

1. User reports:
   *“Garbage overflowing near school”*

2. ORCA:

   * Classifies → Sanitation Department
   * Risk → HIGH
   * Priority → URGENT

3. Automatically:

   * Generates email
   * Sends to authority

4. Authority replies:

   * “We are working on it”

5. ORCA:

   * Updates status → WORKING

---

## 🚀 Deployment Architecture

User → Frontend (Vercel) → Backend API (Render) → Firebase + AI

---

## 🎯 Vision

At ORCA, we are committed to building a future where cities are no longer reactive systems but intelligent,
proactive ecosystems driven by autonomous decision-making. Our vision is to create a unified civic intelligence
layer that not only understands and classifies urban issues in real time but actively ensures they are addressed with speed,
accountability, and precision. By leveraging agentic AI, ORCA moves beyond traditional reporting tools to become a system that 
predicts risks, escalates issues intelligently, and continuously learns from real-world data. We aim to bridge the gap between 
citizens and authorities through seamless, automated communication while bringing transparency into every stage of issue resolution. 
As ORCA evolves, our goal is to scale this system across cities globally, transforming urban governance into a responsive, data-driven, 
and self-improving ecosystem — effectively acting as a digital brain for smarter, safer, and more efficient cities.
---

## 👨‍💻 Author

Built as part of an Agentic AI Hackathon project to demonstrate real-world application of autonomous systems in civic infrastructure.

---
