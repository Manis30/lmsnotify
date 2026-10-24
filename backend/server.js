import express from "express";
import cors from "cors";
import multer from "multer";
import * as XLSX from "xlsx";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mongoose Models
import Campaign from "./models/Campaign.js";
import Message from "./models/Message.js";
import Event from "./models/Event.js";
import Template from "./models/Template.js";
import sanitizeHtml from "sanitize-html";
import { convert as htmlToText } from "html-to-text";

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to MongoDB Atlas
if (process.env.MONGODB_URI) {
  mongoose
    .connect(process.env.MONGODB_URI)
    .then(async () => {
      console.log("Mongo connected");
      await seedDefaultTemplate();
    })
    .catch((err) => {
      console.error("MongoDB connection error:", err.message);
    });
} else {
  console.warn("Notice: MONGODB_URI not provided in environment variables.");
}

// In-memory pointer to the latest campaign jobId
let currentJobId = null;

// Track sync timestamps to avoid polling rate-limits (< 10 seconds debounce)
const jobSyncTimestamps = new Map();
let hasLoggedSampleBrevo = false;

// Configure allowed origins for CORS
const rawClientUrl = process.env.CLIENT_URL || "https://lmsnotify.vercel.app";
const configuredOrigins = rawClientUrl
  .split(",")
  .map((url) => url.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const allowedOrigins = Array.from(
  new Set([
    ...configuredOrigins,
    "https://lmsnotify.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000"
  ])
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const normalizedOrigin = origin.replace(/\/+$/, "");
      if (
        allowedOrigins.includes(normalizedOrigin) ||
        normalizedOrigin.endsWith(".vercel.app") ||
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin)
      ) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);
app.use(express.json());

// Health check endpoints
const getHealthStatus = (req, res) => {
  res.status(200).json({
    status: "ok",
    message: "LMS-Notify Backend API is healthy",
    version: "2.0.0",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    service: "lms-notify-backend",
    mongoConnected: mongoose.connection.readyState === 1,
    currentJobId: currentJobId
  });
};

app.get("/", getHealthStatus);
app.get("/health", getHealthStatus);
app.get("/api/health", getHealthStatus);

// Multer in-memory configuration (no disk writes, max 10MB, Excel only)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (ext === ".xlsx" || ext === ".xls") {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only Excel files (.xlsx, .xls) are allowed."));
    }
  }
});

// Configurable fallback constants for email template variables
const defaultSubject = process.env.EMAIL_SUBJECT || "Enhance Your Teaching Experience with Our Learning Platform";
const defaultApplicationLink = process.env.APPLICATION_LINK || "https://lms-notify.example.com";
const defaultSupportEmail = process.env.SUPPORT_EMAIL || "support@lms-notify.example.com";
const defaultSenderName = process.env.SENDER_NAME || "LMS Notify Team";
const defaultSenderEmail = process.env.MAIL_FROM || "maninature121@gmail.com";

// Helper to escape HTML characters
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Sanitization configuration for email templates
const SANITIZE_OPTIONS = {
  allowedTags: [
    "html", "head", "body", "meta", "title", "style",
    "table", "thead", "tbody", "tfoot", "tr", "th", "td",
    "img", "a", "b", "strong", "i", "em", "u", "s", "strike",
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "span", "div", "center", "font", "blockquote",
    "ul", "ol", "li", "br", "hr", "sub", "sup"
  ],
  allowedAttributes: {
    "*": [
      "style", "class", "id", "width", "height", "align", "valign",
      "bgcolor", "background", "border", "cellpadding", "cellspacing",
      "color", "face", "size", "dir"
    ],
    "a": ["href", "name", "target", "title", "rel"],
    "img": ["src", "alt", "title", "width", "height", "border", "style"],
    "meta": ["http-equiv", "content", "name", "charset"],
    "table": ["width", "height", "border", "cellpadding", "cellspacing", "bgcolor", "align", "style"],
    "td": ["width", "height", "colspan", "rowspan", "align", "valign", "bgcolor", "style"],
    "th": ["width", "height", "colspan", "rowspan", "align", "valign", "bgcolor", "style"]
  },
  disallowedTagsMode: "discard",
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: {
    a: ["http", "https", "mailto"],
    img: ["http", "https", "data"]
  },
  allowProtocolRelative: false
};

function sanitizeEmailHtml(rawHtml) {
  if (!rawHtml) return "";
  return sanitizeHtml(rawHtml, SANITIZE_OPTIONS);
}

function checkTemplateWarnings(html) {
  const warnings = [];
  if (!html || !html.includes("{{name}}")) {
    warnings.push("Template does not contain the {{name}} placeholder for recipient personalization.");
  }
  const hasLink = /href\s*=\s*["'][^"']+["']/i.test(html || "");
  if (!hasLink) {
    warnings.push("Template does not contain any clickable links (href). Click tracking will not work.");
  }
  return warnings;
}

function renderTemplate(htmlTemplate, vars = {}) {
  if (!htmlTemplate) return { html: "", text: "" };

  const defaultVars = {
    name: "Educator",
    applicationLink: defaultApplicationLink,
    supportEmail: defaultSupportEmail,
    senderName: defaultSenderName,
    year: String(new Date().getFullYear()),
    ...vars
  };

  let rendered = String(htmlTemplate).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    if (key === "name") {
      return escapeHtml(defaultVars.name || "Educator");
    }
    if (key in defaultVars) {
      return String(defaultVars[key]);
    }
    return "";
  });

  let textContent = "";
  try {
    textContent = htmlToText(rendered, {
      wordwrap: 130,
      selectors: [
        { selector: "img", format: "skip" },
        { selector: "a", options: { hideLinkHrefIfSameAsText: true } }
      ]
    });
  } catch (textErr) {
    textContent = rendered.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }

  return { html: rendered, text: textContent };
}

function renderSubject(subjectTemplate, vars = {}) {
  if (!subjectTemplate) return defaultSubject;
  return String(subjectTemplate).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    if (key in vars) {
      return String(vars[key]);
    }
    return "";
  });
}

// Seed ONE default template if Template collection is empty
async function seedDefaultTemplate() {
  try {
    const count = await Template.countDocuments();
    if (count === 0) {
      const defaultHtml = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Your Learning Platform</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: Arial, Helvetica, sans-serif; width: 100% !important;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f6f8; padding: 40px 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
                    <tr>
                        <td align="center" bgcolor="#4F46E5" style="padding: 35px 20px; background-color: #4F46E5;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">
                                YOUR LEARNING PLATFORM
                            </h1>
                            <p style="color: #e0e7ff; margin: 6px 0 0 0; font-size: 14px;">
                                Making teaching and learning simpler.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px 35px; color: #334155; font-size: 15px; line-height: 1.6;">
                            <p style="margin-top: 0; margin-bottom: 20px; font-size: 16px; font-weight: 700; color: #1e293b;">
                                Hello {{name}},
                            </p>
                            <h2 style="color: #4F46E5; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 14px;">
                                Make Teaching More Simple &amp; Effective
                            </h2>
                            <p style="margin-top: 0; margin-bottom: 16px; color: #475569;">
                                We are excited to introduce our learning platform, designed to make teaching and learning more organized, accessible, and convenient.
                            </p>
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 28px;">
                                <tr>
                                    <td align="center">
                                        <a href="{{applicationLink}}" target="_blank" style="background-color: #4F46E5; color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 6px; font-weight: 700; font-size: 15px; display: inline-block;">
                                            Explore the Platform
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; color: #64748b;">
                                <p style="margin: 0 0 6px 0; font-weight: 700; color: #1e293b; font-size: 14px;">Have questions?</p>
                                <p style="margin: 0; font-size: 14px; color: #475569;">
                                    Contact us at <a href="mailto:{{supportEmail}}" style="color: #4F46E5;">{{supportEmail}}</a>.
                                </p>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td align="center" bgcolor="#f8fafc" style="background-color: #f8fafc; padding: 20px 35px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 13px; text-align: center;">
                            <p style="margin: 0 0 4px 0; font-weight: 700; color: #334155;">{{senderName}}</p>
                            <p style="margin: 0; color: #94a3b8; font-size: 12px;">© {{year}} LMS Notify. All rights reserved.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;

      await Template.create({
        name: "Standard Learning Platform Newsletter",
        subject: defaultSubject,
        html: defaultHtml,
        design: null,
        isDefault: true,
        version: 1
      });
      console.log("[MongoDB] Seeded initial default newsletter template successfully.");
    }
  } catch (err) {
    console.error("[seedDefaultTemplate] Error seeding default template:", err);
  }
}

function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email.trim());
}

// Helper to run promises with limited concurrency (~5)
async function runConcurrent(items, limit, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += limit) {
    const chunk = items.slice(i, i + limit);
    const chunkRes = await Promise.all(chunk.map(fn));
    results.push(...chunkRes);
  }
  return results;
}

/**
 * === SECTION C: SYNC FROM BREVO ===
 * Polls Brevo's Transactional Events API for each Message in the campaign,
 * drops old events prior to sentAt, upserts them into MongoDB Event collection,
 * and recomputes the Message delivery status and timeline metrics.
 */
async function syncJob(jobId) {
  if (!jobId) return;

  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    console.warn("[syncJob] Skipping sync: BREVO_API_KEY not configured.");
    return;
  }

  // 1. Skip sync if it ran less than 10 seconds ago for this job
  const lastSync = jobSyncTimestamps.get(jobId);
  const now = Date.now();
  if (lastSync && now - lastSync < 10000) {
    return;
  }
  jobSyncTimestamps.set(jobId, now);

  try {
    // 2. Fetch all valid messages with a messageId for this jobId
    const messages = await Message.find({
      jobId,
      messageId: { $exists: true, $ne: null, $ne: "" },
      status: { $ne: "Failed" }
    });

    if (!messages || messages.length === 0) {
      return;
    }

    let totalEventsRetrieved = 0;

    // 3. Concurrently poll Brevo API by messageId (limit concurrency to 5)
    await runConcurrent(messages, 5, async (msg) => {
      const cleanMsgId = msg.messageId;
      if (!cleanMsgId) return;

      // Brevo API expects angle brackets URL-encoded
      const encodedMsgId = encodeURIComponent(`<${cleanMsgId}>`);
      const url = `https://api.brevo.com/v3/smtp/statistics/events?messageId=${encodedMsgId}&limit=100&sort=asc`;

      let rawEvents = [];
      try {
        const response = await fetch(url, {
          method: "GET",
          headers: {
            accept: "application/json",
            "api-key": apiKey
          }
        });

        if (response.ok) {
          const data = await response.json();
          rawEvents = data.events || [];

          // Temporary log of raw Brevo response for ONE messageId to verify field names
          if (!hasLoggedSampleBrevo && rawEvents.length > 0) {
            console.log("[Brevo API Sample Event Response]:", JSON.stringify(rawEvents[0], null, 2));
            hasLoggedSampleBrevo = true;
          }
        }
      } catch (fetchErr) {
        console.error(`[syncJob] Error fetching events for messageId ${cleanMsgId}:`, fetchErr.message);
      }

      totalEventsRetrieved += rawEvents.length;

      // 4. Drop any event dated earlier than the Message's sentAt minus 1 minute
      const minAllowedTime = msg.sentAt ? new Date(msg.sentAt.getTime() - 60000) : new Date(0);
      const validEvents = rawEvents.filter((ev) => ev.date && new Date(ev.date) >= minAllowedTime);

      // 5. Upsert each remaining event into the Event collection (dedupe by messageId + type + date)
      for (const ev of validEvents) {
        const evType = ev.event;
        const evDate = new Date(ev.date);
        await Event.updateOne(
          { messageId: cleanMsgId, type: evType, date: evDate },
          {
            $set: {
              messageId: cleanMsgId,
              jobId: msg.jobId,
              type: evType,
              date: evDate,
              link: ev.link || null,
              reason: ev.reason || null,
              raw: ev
            }
          },
          { upsert: true }
        );
      }

      // 6. Recompute the Message summary from its Event documents
      const allEvents = await Event.find({ messageId: cleanMsgId }).sort({ date: 1 });
      if (allEvents.length > 0) {
        const hasClicked = allEvents.some((e) => e.type === "clicks" || e.type === "click");
        const hasOpened = allEvents.some((e) => e.type === "opened" || e.type === "first_opening");
        const hasDelivered = allEvents.some((e) => e.type === "delivered");
        const hasBounced = allEvents.some(
          (e) => e.type === "hardBounces" || e.type === "softBounces" || e.type.includes("bounce")
        );
        const hasBlocked = allEvents.some(
          (e) => e.type === "blocked" || e.type === "spam" || e.type === "invalid"
        );
        const hasSent = allEvents.some((e) => e.type === "requests" || e.type === "sent");

        // Priority: Clicked > Opened > Delivered > Sent; Bounced/Blocked override Delivered/Sent
        let computedStatus = "Sent";
        if (hasClicked) {
          computedStatus = "Clicked";
        } else if (hasOpened) {
          computedStatus = "Opened";
        } else if (hasBounced) {
          computedStatus = "Bounced";
        } else if (hasBlocked) {
          computedStatus = "Blocked";
        } else if (hasDelivered) {
          computedStatus = "Delivered";
        } else if (hasSent) {
          computedStatus = "Sent";
        }

        const openEvents = allEvents.filter(
          (e) => (e.type === "opened" || e.type === "first_opening") && e.date >= (msg.sentAt || new Date(0))
        );
        const firstOpenedAt = openEvents.length > 0 ? openEvents[0].date : null;
        const lastOpenedAt = openEvents.length > 0 ? openEvents[openEvents.length - 1].date : null;
        const openCount = openEvents.length;

        const proxyOpenCount = allEvents.filter((e) => e.type === "loadedByProxy").length;

        const clickEvents = allEvents.filter((e) => e.type === "clicks" || e.type === "click");
        const clickCount = clickEvents.length;
        const lastClickedLink =
          clickEvents.length > 0 ? clickEvents[clickEvents.length - 1].link || null : null;

        const newestEvent = allEvents[allEvents.length - 1];
        const lastEvent = newestEvent ? newestEvent.type : "requests";
        const lastEventAt = newestEvent ? newestEvent.date : msg.sentAt;

        await Message.updateOne(
          { _id: msg._id },
          {
            $set: {
              status: computedStatus,
              firstOpenedAt,
              lastOpenedAt,
              openCount,
              proxyOpenCount,
              clickCount,
              lastClickedLink,
              lastEvent,
              lastEventAt
            }
          }
        );
      }
    });

    // Fallback: If messageId query returned nothing, query by jobId tag for today
    if (totalEventsRetrieved === 0) {
      try {
        const today = new Date().toISOString().split("T")[0];
        const tagUrl = `https://api.brevo.com/v3/smtp/statistics/events?tags=${encodeURIComponent(
          jobId
        )}&startDate=${today}&endDate=${today}&limit=100&sort=asc`;

        const tagRes = await fetch(tagUrl, {
          method: "GET",
          headers: { accept: "application/json", "api-key": apiKey }
        });

        if (tagRes.ok) {
          const tagData = await tagRes.json();
          const tagEvents = tagData.events || [];

          for (const ev of tagEvents) {
            const evMsgId = (ev.messageId || "").replace(/[<>]/g, "").trim();
            const matchedMsg = messages.find((m) => m.messageId === evMsgId);
            if (!matchedMsg) continue;

            const minAllowedTime = matchedMsg.sentAt
              ? new Date(matchedMsg.sentAt.getTime() - 60000)
              : new Date(0);
            if (!ev.date || new Date(ev.date) < minAllowedTime) continue;

            const evType = ev.event;
            const evDate = new Date(ev.date);

            await Event.updateOne(
              { messageId: evMsgId, type: evType, date: evDate },
              {
                $set: {
                  messageId: evMsgId,
                  jobId,
                  type: evType,
                  date: evDate,
                  link: ev.link || null,
                  reason: ev.reason || null,
                  raw: ev
                }
              },
              { upsert: true }
            );
          }
        }
      } catch (tagErr) {
        console.warn("[syncJob] Tag fallback notice:", tagErr.message);
      }
    }
  } catch (err) {
    console.error("[syncJob] Fatal error during sync:", err);
  }
}

/**
 * === SECTION B: SEND FLOW (POST https://api.brevo.com/v3/smtp/email) ===
 * Accepts an Excel spreadsheet, creates Campaign and Message records,
 * and sends each recipient via Brevo transactional API with tags: [jobId].
 */
app.post("/send-mails", upload.single("file"), async (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({
      success: false,
      message: "Please upload an Excel file."
    });
  }

  const originalName = req.file.originalname || "";

  if (!originalName.toLowerCase().endsWith(".xlsx") && !originalName.toLowerCase().endsWith(".xls")) {
    return res.status(400).json({
      success: false,
      message: "Invalid file format. Please upload an .xlsx or .xls file."
    });
  }

  try {
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      throw new Error("Excel file has no sheets");
    }

    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    if (!data || data.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Excel file is empty or contains no valid rows."
      });
    }

    if (data.length > 500) {
      return res.status(400).json({
        success: false,
        message: "File exceeds the maximum limit of 500 recipients per upload."
      });
    }

    // Resolve email template (requested templateId or default template)
    let template = null;
    const requestedTemplateId = req.body && req.body.templateId ? String(req.body.templateId).trim() : null;
    if (requestedTemplateId) {
      try {
        template = await Template.findById(requestedTemplateId);
      } catch (tErr) {
        // invalid ObjectId fallback
      }
    }
    if (!template) {
      template = (await Template.findOne({ isDefault: true })) || (await Template.findOne());
    }
    if (!template) {
      await seedDefaultTemplate();
      template = await Template.findOne();
    }
    if (!template) {
      return res.status(500).json({
        success: false,
        message: "No email template available. Please configure a template in the Template Editor first."
      });
    }

    // Generate unique jobId per upload/send
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    currentJobId = jobId;
    const sentAt = new Date();

    // Create Campaign document in MongoDB with full template snapshot
    await Campaign.create({
      jobId,
      fileName: originalName,
      subject: template.subject,
      total: data.length,
      templateId: template._id,
      templateName: template.name,
      subjectSnapshot: template.subject,
      htmlSnapshot: template.html,
      sentAt,
      createdAt: sentAt
    });

    const results = [];
    let sentCount = 0;
    let failedCount = 0;

    // Send emails sequentially or in small batches via Brevo Transactional API
    for (let idx = 0; idx < data.length; idx++) {
      const row = data[idx];
      const rowKeys = Object.keys(row);
      const nameKey = rowKeys.find((k) => /^name$/i.test(k.trim())) || "Name";
      const emailKey = rowKeys.find((k) => /^email$/i.test(k.trim())) || "Email";

      const name = row[nameKey] ? String(row[nameKey]).trim() : "";
      const email = row[emailKey] ? String(row[emailKey]).trim() : "";

      // Validate presence of Name, Email, and Email format
      if (!name || !email || !isValidEmail(email)) {
        const failReason = !name
          ? "Missing recipient name"
          : !email
          ? "Missing email address"
          : "Invalid email format";

        const failedMsg = await Message.create({
          jobId,
          rowIndex: idx,
          name: name || "N/A",
          email: email || "N/A",
          status: "Failed",
          failReason,
          sentAt,
          lastEvent: "failed",
          lastEventAt: sentAt
        });

        results.push(failedMsg);
        failedCount++;
        continue;
      }

      const recipientVars = {
        name: name,
        applicationLink: defaultApplicationLink,
        supportEmail: defaultSupportEmail,
        senderName: defaultSenderName,
        year: String(new Date().getFullYear())
      };

      const { html: emailHtml, text: emailText } = renderTemplate(template.html, recipientVars);
      const renderedSubject = renderSubject(template.subject, recipientVars);

      const payload = {
        sender: {
          name: defaultSenderName,
          email: defaultSenderEmail
        },
        to: [
          {
            email: email,
            name: name
          }
        ],
        subject: renderedSubject,
        htmlContent: emailHtml,
        textContent: emailText,
        tags: [jobId]
      };

      try {
        const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: {
            accept: "application/json",
            "api-key": process.env.BREVO_API_KEY,
            "content-type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        if (brevoRes.ok) {
          const resData = await brevoRes.json();
          const rawMsgId = resData.messageId || "";
          const cleanMsgId = rawMsgId.replace(/[<>]/g, "").trim();

          const messageDoc = await Message.create({
            jobId,
            rowIndex: idx,
            name,
            email,
            messageId: cleanMsgId,
            status: "Sent",
            sentAt,
            lastEvent: "requests",
            lastEventAt: sentAt
          });

          // Insert initial 'requests' event
          await Event.updateOne(
            { messageId: cleanMsgId, type: "requests", date: sentAt },
            {
              $set: {
                messageId: cleanMsgId,
                jobId,
                type: "requests",
                date: sentAt,
                raw: { event: "requests", date: sentAt }
              }
            },
            { upsert: true }
          ).catch(() => {});

          results.push(messageDoc);
          sentCount++;
        } else {
          const errText = await brevoRes.text();
          console.error(`Brevo API send error for ${email}:`, errText);

          const failedMsg = await Message.create({
            jobId,
            rowIndex: idx,
            name,
            email,
            status: "Failed",
            failReason: `Brevo API error (${brevoRes.status}): ${errText}`,
            sentAt,
            lastEvent: "failed",
            lastEventAt: sentAt
          });

          results.push(failedMsg);
          failedCount++;
        }
      } catch (sendErr) {
        console.error(`Error sending email to ${email}:`, sendErr.message);

        const failedMsg = await Message.create({
          jobId,
          rowIndex: idx,
          name,
          email,
          status: "Failed",
          failReason: sendErr.message,
          sentAt,
          lastEvent: "failed",
          lastEventAt: sentAt
        });

        results.push(failedMsg);
        failedCount++;
      }
    }

    return res.json({
      success: true,
      message: "Mail sending completed",
      jobId,
      total: results.length,
      sent: sentCount,
      failed: failedCount
    });
  } catch (error) {
    console.error("Error processing Excel file:", error);
    return res.status(500).json({
      success: false,
      message: "Excel parsing or processing error: " + error.message
    });
  }
});

/**
 * === SECTION D: API ROUTES ===
 * GET /delivery-status?jobId=<optional>
 * Synchronizes recent events from Brevo for the targeted campaign,
 * then returns all recipient results keyed by messageId and rowIndex.
 */
app.get("/delivery-status", async (req, res) => {
  try {
    let targetJobId = req.query.jobId || currentJobId;

    // Fallback: If no jobId provided, get the latest campaign from MongoDB
    if (!targetJobId) {
      const latestCampaign = await Campaign.findOne().sort({ createdAt: -1 });
      if (latestCampaign) {
        targetJobId = latestCampaign.jobId;
        currentJobId = targetJobId;
      }
    }

    if (!targetJobId) {
      return res.json({
        success: true,
        jobId: null,
        totals: { total: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0, blocked: 0, failed: 0 },
        results: []
      });
    }

    // 1. Run syncJob to poll latest events from Brevo
    await syncJob(targetJobId);

    // 2. Fetch all Message documents for this jobId sorted by rowIndex
    const messages = await Message.find({ jobId: targetJobId }).sort({ rowIndex: 1 });

    // 3. Compute totals
    const totals = {
      total: messages.length,
      sent: messages.filter((m) => m.status === "Sent").length,
      delivered: messages.filter((m) => m.status === "Delivered" || m.status === "Opened" || m.status === "Clicked").length,
      opened: messages.filter((m) => m.status === "Opened" || m.status === "Clicked").length,
      clicked: messages.filter((m) => m.status === "Clicked").length,
      bounced: messages.filter((m) => m.status === "Bounced").length,
      blocked: messages.filter((m) => m.status === "Blocked").length,
      failed: messages.filter((m) => m.status === "Failed").length
    };

    // 4. Map results with explicit fields
    const results = messages.map((m) => ({
      rowIndex: m.rowIndex,
      name: m.name,
      email: m.email,
      messageId: m.messageId || null,
      status: m.status,
      lastEvent: m.lastEvent,
      lastEventAt: m.lastEventAt,
      sentAt: m.sentAt,
      firstOpenedAt: m.firstOpenedAt,
      lastOpenedAt: m.lastOpenedAt,
      openCount: m.openCount || 0,
      proxyOpenCount: m.proxyOpenCount || 0,
      clickCount: m.clickCount || 0,
      lastClickedLink: m.lastClickedLink || null,
      failReason: m.failReason || null
    }));

    return res.json({
      success: true,
      jobId: targetJobId,
      totals,
      results
    });
  } catch (err) {
    console.error("Error in /delivery-status:", err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// Alias for backwards compatibility
app.get("/status", (req, res) => {
  res.redirect(307, `/delivery-status${req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : ""}`);
});

/**
 * GET /campaigns
 * Returns list of past campaigns, newest first, with summary counts.
 */
app.get("/campaigns", async (req, res) => {
  try {
    const campaigns = await Campaign.find().sort({ createdAt: -1 }).limit(50);

    const campaignsWithCounts = await Promise.all(
      campaigns.map(async (c) => {
        const msgs = await Message.find({ jobId: c.jobId });
        return {
          jobId: c.jobId,
          fileName: c.fileName,
          subject: c.subjectSnapshot || c.subject,
          templateId: c.templateId || null,
          templateName: c.templateName || "Default Template",
          subjectSnapshot: c.subjectSnapshot || c.subject,
          htmlSnapshot: c.htmlSnapshot || null,
          total: c.total || msgs.length,
          sentAt: c.sentAt,
          createdAt: c.createdAt,
          counts: {
            total: msgs.length,
            sent: msgs.filter((m) => m.status === "Sent").length,
            delivered: msgs.filter((m) => ["Delivered", "Opened", "Clicked"].includes(m.status)).length,
            opened: msgs.filter((m) => ["Opened", "Clicked"].includes(m.status)).length,
            clicked: msgs.filter((m) => m.status === "Clicked").length,
            bounced: msgs.filter((m) => ["Bounced", "Blocked", "Failed"].includes(m.status)).length
          }
        };
      })
    );

    return res.json({
      success: true,
      campaigns: campaignsWithCounts
    });
  } catch (err) {
    console.error("Error in /campaigns:", err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

/**
 * GET /messages/:messageId/events
 * Returns all Event documents for that specific email, oldest first.
 */
app.get("/messages/:messageId/events", async (req, res) => {
  try {
    const cleanMsgId = String(req.params.messageId || "").replace(/[<>]/g, "").trim();
    if (!cleanMsgId) {
      return res.status(400).json({ success: false, message: "Invalid messageId" });
    }

    const events = await Event.find({ messageId: cleanMsgId }).sort({ date: 1 });

    return res.json({
      success: true,
      messageId: cleanMsgId,
      events
    });
  } catch (err) {
    console.error("Error in /messages/:messageId/events:", err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

/**
 * === SECTION E: NEWSLETTER TEMPLATE ROUTES ===
 */

// GET /templates - List templates (lightweight: no html or design payload)
app.get("/templates", async (req, res) => {
  try {
    const count = await Template.countDocuments();
    if (count === 0) {
      await seedDefaultTemplate();
    }

    const templates = await Template.find({}, "_id name subject isDefault version createdAt updatedAt")
      .sort({ isDefault: -1, updatedAt: -1 });

    return res.json({
      success: true,
      templates
    });
  } catch (err) {
    console.error("Error in GET /templates:", err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// GET /templates/:id - Retrieve full template details
app.get("/templates/:id", async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Template not found"
      });
    }

    return res.json({
      success: true,
      template
    });
  } catch (err) {
    console.error("Error in GET /templates/:id:", err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// POST /templates - Create new template
app.post("/templates", async (req, res) => {
  try {
    const { name, subject: tplSubject, html, design, isDefault } = req.body || {};

    if (!name || !String(name).trim()) {
      return res.status(400).json({
        success: false,
        message: "Template name is required."
      });
    }

    if (!tplSubject || !String(tplSubject).trim()) {
      return res.status(400).json({
        success: false,
        message: "Email subject is required."
      });
    }

    const sanitizedHtml = sanitizeEmailHtml(html || "");
    const warnings = checkTemplateWarnings(sanitizedHtml);

    // If marked as default, unset any existing default
    if (isDefault) {
      await Template.updateMany({}, { isDefault: false });
    } else {
      // If this is the very first template, enforce default
      const totalCount = await Template.countDocuments();
      if (totalCount === 0) {
        req.body.isDefault = true;
      }
    }

    const newTemplate = await Template.create({
      name: String(name).trim(),
      subject: String(tplSubject).trim(),
      html: sanitizedHtml,
      design: design || null,
      isDefault: Boolean(req.body.isDefault),
      version: 1
    });

    return res.status(201).json({
      success: true,
      message: "Template created successfully",
      template: newTemplate,
      warnings
    });
  } catch (err) {
    console.error("Error in POST /templates:", err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// PUT /templates/:id - Update existing template
app.put("/templates/:id", async (req, res) => {
  try {
    const template = await Template.findById(req.params.id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Template not found"
      });
    }

    const { name, subject: tplSubject, html, design, isDefault } = req.body || {};

    if (name && String(name).trim()) {
      template.name = String(name).trim();
    }
    if (tplSubject && String(tplSubject).trim()) {
      template.subject = String(tplSubject).trim();
    }
    if (html !== undefined) {
      template.html = sanitizeEmailHtml(html);
    }
    if (design !== undefined) {
      template.design = design;
    }

    if (isDefault === true) {
      await Template.updateMany({ _id: { $ne: template._id } }, { isDefault: false });
      template.isDefault = true;
    } else if (isDefault === false && template.isDefault) {
      // If unsetting this default, make sure another template is designated as default
      template.isDefault = false;
      const other = await Template.findOne({ _id: { $ne: template._id } });
      if (other) {
        other.isDefault = true;
        await other.save();
      }
    }

    // Increment version on every save
    template.version = (template.version || 1) + 1;
    await template.save();

    const warnings = checkTemplateWarnings(template.html);

    return res.json({
      success: true,
      message: "Template updated successfully",
      template,
      warnings
    });
  } catch (err) {
    console.error("Error in PUT /templates/:id:", err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// DELETE /templates/:id - Delete template (blocked if only 1 template remains)
app.delete("/templates/:id", async (req, res) => {
  try {
    const totalCount = await Template.countDocuments();
    if (totalCount <= 1) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete the last remaining template. You must have at least one template."
      });
    }

    const template = await Template.findById(req.params.id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Template not found"
      });
    }

    const wasDefault = template.isDefault;
    await Template.findByIdAndDelete(req.params.id);

    // If default template was deleted, designate the newest remaining template as default
    if (wasDefault) {
      const fallback = await Template.findOne().sort({ updatedAt: -1 });
      if (fallback) {
        fallback.isDefault = true;
        await fallback.save();
      }
    }

    return res.json({
      success: true,
      message: "Template deleted successfully"
    });
  } catch (err) {
    console.error("Error in DELETE /templates/:id:", err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// POST /templates/:id/duplicate - Duplicate an existing template
app.post("/templates/:id/duplicate", async (req, res) => {
  try {
    const source = await Template.findById(req.params.id);
    if (!source) {
      return res.status(404).json({
        success: false,
        message: "Source template not found"
      });
    }

    const duplicate = await Template.create({
      name: `${source.name} (Copy)`,
      subject: source.subject,
      html: source.html,
      design: source.design,
      isDefault: false,
      version: 1
    });

    return res.status(201).json({
      success: true,
      message: "Template duplicated successfully",
      template: duplicate
    });
  } catch (err) {
    console.error("Error in POST /templates/:id/duplicate:", err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// POST /templates/preview - Render HTML preview with filled variables
app.post("/templates/preview", (req, res) => {
  try {
    const { html, sampleName } = req.body || {};
    const { html: renderedHtml, text: renderedText } = renderTemplate(html || "", {
      name: sampleName || "Priya"
    });

    return res.json({
      success: true,
      html: renderedHtml,
      text: renderedText
    });
  } catch (err) {
    console.error("Error in POST /templates/preview:", err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// POST /templates/:id/test-send - Send single test mail via Brevo without creating Campaign
app.post("/templates/:id/test-send", async (req, res) => {
  try {
    const { toEmail } = req.body || {};
    if (!toEmail || !isValidEmail(toEmail)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid recipient email address."
      });
    }

    const template = await Template.findById(req.params.id);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: "Template not found"
      });
    }

    const apiKey = process.env.BREVO_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: "BREVO_API_KEY is not configured on the server."
      });
    }

    const testVars = {
      name: "Priya",
      applicationLink: defaultApplicationLink,
      supportEmail: defaultSupportEmail,
      senderName: defaultSenderName,
      year: String(new Date().getFullYear())
    };

    const { html: renderedHtml, text: renderedText } = renderTemplate(template.html, testVars);
    const renderedSubject = `[TEST] ${renderSubject(template.subject, testVars)}`;

    const brevoPayload = {
      sender: {
        name: defaultSenderName,
        email: defaultSenderEmail
      },
      to: [
        {
          email: toEmail.trim(),
          name: "Test Recipient (Priya)"
        }
      ],
      subject: renderedSubject,
      htmlContent: renderedHtml,
      textContent: renderedText,
      tags: ["template-test"]
    };

    const brevoRes = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "content-type": "application/json"
      },
      body: JSON.stringify(brevoPayload)
    });

    const brevoData = await brevoRes.json();
    if (!brevoRes.ok) {
      throw new Error(brevoData.message || "Brevo test send was rejected.");
    }

    const rawMsgId = brevoData.messageId || "";
    const cleanMsgId = rawMsgId.replace(/[<>]/g, "").trim();

    return res.json({
      success: true,
      message: `Test email sent successfully to ${toEmail}`,
      messageId: cleanMsgId
    });
  } catch (err) {
    console.error("Error in POST /templates/:id/test-send:", err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
});

// 404 handler for undefined routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

// Centralized error-handling middleware
app.use((err, req, res, next) => {
  console.error("Server error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error"
  });
});

// Start Express server
const server = app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use.`);
  } else {
    console.error("Server error:", err.message);
  }
});