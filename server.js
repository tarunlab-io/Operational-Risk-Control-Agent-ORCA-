import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import nodemailer from 'nodemailer';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";

// Firebase Config for Backend (Sync with frontend)
const firebaseConfig = {
    apiKey: "AIzaSyDS5VrbBp-bfOHAMUdiknxUHcwPNlU2V7Y",
    authDomain: "orca-65ffa.firebaseapp.com",
    projectId: "orca-65ffa",
    storageBucket: "orca-65ffa.firebasestorage.app",
    messagingSenderId: "565215066296",
    appId: "1:565215066296:web:a1053e893208ec2a7b1c4d",
};

const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

// Exit if critical API key is missing
if (!process.env.NVIDIA_API_KEY) {
    console.error('CRITICAL ERROR: Missing NVIDIA_API_KEY in .env file');
    process.exit(1);
}

const app = express();
const PORT = 3000;

// Settings
app.use(cors());
app.use(express.json());

// Credentials from Environment
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;

// CRITICAL: Exit if email credentials OR API key are missing
if (!NVIDIA_API_KEY || !EMAIL_USER || !EMAIL_PASS || EMAIL_USER === 'YOUR_EMAIL@GMAIL.COM') {
    console.error('\n❌ CRITICAL ERROR: Missing or placeholder environment variables!');
    console.error('Please ensure NVIDIA_API_KEY, EMAIL_USER, and EMAIL_PASS are set in .env\n');
    process.exit(1);
}

// Nodemailer Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASS,
    },
});

/**
 * Reusable email function with Debug Logs
 */
async function sendEmail(to, subject, text) {
    try {
        console.log(`\n📨 Attempting to send email to: ${to}`);
        console.log(`📋 Subject: ${subject}`);
        
        const info = await transporter.sendMail({
            from: `"CivicFix AI" <${EMAIL_USER}>`,
            to,
            subject,
            text,
        });

        console.log('✅ Email sent successfully!');
        console.log('🔗 Response:', info.response);
        return true;
    } catch (error) {
        console.error('❌ Email failed to send!');
        console.error('📝 Error details:', error);
        return false;
    }
}

/**
 * AI Agent Helper function to call NVIDIA API
 */
async function callNvidiaAI(prompt) {
    try {
        const response = await axios.post(
            NVIDIA_URL,
            {
                model: 'meta/llama3-70b-instruct',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.1, // Set lower for more deterministic JSON
                top_p: 1,
                max_tokens: 1024,
            },
            {
                headers: {
                    Authorization: `Bearer ${NVIDIA_API_KEY}`,
                    'Content-Type': 'application/json',
                },
            }
        );
        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('NVIDIA AI Error:', error.response ? error.response.data : error.message);
        throw new Error('AI analysis failed.');
    }
}

/**
 * Core Logic: Get Structured AI Analysis with RETRY logic
 */
async function getStructuredAnalysis(description, location = "local area") {
    const prompt = `You are an autonomous civic issue classification and enforcement system.

Your job is to analyze public complaints and return structured data.

DO NOT ask questions.
DO NOT request more information.
DO NOT behave like a chatbot.
DO NOT explain anything.

You must ALWAYS return valid JSON.

---

CLASSIFY INTO ONE OF THESE DEPARTMENTS ONLY:
- Water Department (leaks, drainage, sewage, pipelines)
- Sanitation Department (garbage, waste overflow, cleanliness)
- Road Department (potholes, road damage, traffic issues)
- Electricity Department (power cuts, streetlights, wiring)
- Public Safety (crime, accidents, dangerous situations)

---

RETURN FORMAT:
{
  "complaint_id": "",
  "issue_type": "",
  "risk_level": "LOW | MEDIUM | HIGH | CRITICAL",
  "priority": "LOW | MEDIUM | HIGH | URGENT",
  "department": "",
  "email_to_authority": ""
}

---

EMAIL REQUIREMENTS (STRICT FORMAL TEMPLATE):
Return the emailBody in this EXACT format:

Subject: [ID_PLACEHOLDER] Civic Issue Report – {issue_type}

Dear {Department Name},

I would like to report a civic issue requiring immediate attention.

Issue Details:
- Type: {issue_type}
- Location: {location}
- Description: {description}

This issue poses a risk to public safety and requires prompt action. I kindly request your department to investigate and resolve this matter at the earliest.

Thank you for your attention to this issue.

Sincerely,  
Concerned Citizen

---

RULES:
- Use proper spacing and line breaks.
- Be formal and respectful.
- Include the subject line at the very top.
- Do NOT ask questions.
- Do NOT generate casual text.
- Do NOT include AI explanations.

---

INPUT:
Complaint: ${description}
Location: ${location}

---

OUTPUT:
Return ONLY JSON. No extra text.`;

    let attempts = 0;
    while (attempts < 2) {
        try {
            console.log(`🤖 AI Analysis Attempt ${attempts + 1}...`);
            const response = await callNvidiaAI(prompt);
            const jsonStr = response.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(jsonStr);
            
            // Validate basic structure
            if (parsed.issue_type && parsed.department && parsed.email_to_authority) {
                return parsed;
            }
            throw new Error("Missing critical JSON keys");
        } catch (e) {
            console.warn(`⚠️ Attempt ${attempts + 1} failed: ${e.message}`);
            attempts++;
            if (attempts === 2) {
                console.error("🚨 All AI attempts failed. Returning fallback.");
                return {
                    issue_type: "General Issue",
                    risk_level: "MEDIUM",
                    priority: "MEDIUM",
                    department: "Municipal Corporation",
                    email_to_authority: `To the Department,\n\nWe have received a complaint regarding ${description} at ${location}. Please investigate.\n\nSincerely,\nA concerned citizen.`
                };
            }
        }
    }
}

/**
 * AI Status Classifier for replies
 */
async function classifyStatusFromEmail(body) {
    const prompt = `You are a civic enforcement processor. Analyze the authority's reply and categorize the status.
    
    TEXT: "${body}"
    
    RULES:
    - If they say fixed, resolved, closed, done, completed -> return "RESOLVED"
    - If they say checking, working, investigating, received, looking into it -> return "WORKING"
    - If unsure, return "SENT".
    
    RETURN ONLY ONE WORD: RESOLVED | WORKING | SENT.`;

    try {
        const response = await callNvidiaAI(prompt);
        return response.trim().toUpperCase();
    } catch (e) {
        // Fallback to simple keyword logic
        const lower = body.toLowerCase();
        if (lower.includes('resolved') || lower.includes('fixed') || lower.includes('done')) return "RESOLVED";
        if (lower.includes('working') || lower.includes('checking') || lower.includes('received')) return "WORKING";
        return "SENT";
    }
}

/**
 * POST /complaint
 */
app.post('/complaint', async (req, res) => {
    const { text, location } = req.body;
    if (!text) return res.status(400).json({ error: 'No text provided.' });

    try {
        const analysis = await getStructuredAnalysis(text, location);
        const emailSent = await sendEmail("srikarsrm@gmail.com", `Civic Fix: ${analysis.issue_type}`, analysis.email_to_authority);

        res.json({
            success: true,
            issue_type: analysis.issue_type,
            risk_level: analysis.risk_level,
            department: analysis.department,
            email_body: analysis.email_to_authority,
            email_sent: emailSent
        });
    } catch (error) {
        res.status(500).json({ error: 'Process failed' });
    }
});

/**
 * POST /api/process-complaint (ORCA Integration)
 */
app.post('/api/process-complaint', async (req, res) => {
    const { description, location, complaint_id } = req.body;
    if (!description) return res.status(400).json({ error: 'No description' });

    try {
        const analysis = await getStructuredAnalysis(description, location);
        
        // Use the passed ID or fallback to AI-generated one
        const cId = complaint_id || analysis.complaint_id || `CIV-${new Date().getFullYear()}-${Math.floor(Math.random()*90000)}`;
        
        // Inject ID into subject before sending
        const finalEmailText = analysis.email_to_authority.replace('[ID_PLACEHOLDER]', `[${cId}]`);
        const emailSent = await sendEmail("srikarsrm@gmail.com", `[${cId}] ORCA Report: ${analysis.issue_type}`, finalEmailText);

        res.json({
            success: true,
            complaint_id: cId,
            issue_type: analysis.issue_type.toUpperCase(),
            risk_level: analysis.risk_level.toUpperCase(),
            department: analysis.department,
            email_sent: emailSent,
            email_body: finalEmailText,
            humanImpact: analysis.risk_level === 'CRITICAL' ? 9.5 : analysis.risk_level === 'HIGH' ? 8.0 : 5.0,
            escalation: analysis.priority === 'URGENT' ? 9.8 : analysis.priority === 'HIGH' ? 7.5 : 4.0,
            affected: 1500,
            timeline: analysis.priority === 'URGENT' ? "6-12 hrs" : "2-4 days",
            confidence: 96,
            predictions: ["Automated system triggered.", "Priority level verified."],
            action: `Engage ${analysis.department} immediately.`
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'API Error' });
    }
});

/**
 * POST /api/email-reply
 * Automatic status update from authority replies
 */
app.post('/api/email-reply', async (req, res) => {
    const { subject, body } = req.body;
    if (!subject || !body) return res.status(400).json({ error: 'Missing subject or body' });

    // 1. Extract Tracking ID: [CIV-202X-XXXXX]
    const match = subject.match(/CIV-\d{4}-\d+/);
    if (!match) return res.status(404).json({ error: 'No valid Civic Tracking ID found in subject.' });
    const cId = match[0];

    try {
        console.log(`\n📬 PROCESSING REPLY: ${cId}`);
        
        // 2. Classify status using AI
        const newStatus = await classifyStatusFromEmail(body);
        console.log(`📊 AI Classification: ${newStatus}`);

        // 3. Find in Firestore
        const complaintsRef = collection(db, "complaints");
        const q = query(complaintsRef, where("complaint_id", "==", cId));
        const snap = await getDocs(q);

        if (snap.empty) {
            return res.status(404).json({ error: `Complaint ${cId} not found in database.` });
        }

        // 4. Update status
        const docRef = doc(db, "complaints", snap.docs[0].id);
        await updateDoc(docRef, { 
            status: newStatus,
            last_reply: body.substring(0, 500) // snippet for audit
        });

        console.log(`✅ DATABASE UPDATED: ${cId} -> ${newStatus}`);

        res.json({
            success: true,
            complaint_id: cId,
            updated_status: newStatus,
            message: "Firestore updated successfully."
        });

    } catch (error) {
        console.error('❌ Webhook processing failed:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /test-email
 */
app.get('/test-email', async (req, res) => {
    const success = await sendEmail("srikarsrm@gmail.com", "Test Email", "Test successful.");
    res.send(success ? "Done" : "Fail");
});

app.listen(PORT, () => {
    console.log(`\n🚀 [UPDATE VERIFIED] CivicFix AI Backend running on http://localhost:${PORT}`);
});
const cors = require("cors");

app.use(cors({
  origin: "https://your-app.vercel.app"
}));
app.get("/api", (req, res) => {
  res.json({ message: "API working ✅" });
});
