const express = require("express");
const cors = require("cors");
const multer = require("multer");
const XLSX = require("xlsx");
const nodemailer = require("nodemailer");
const dotenv = require("dotenv");
const fs = require("fs");
const path = require("path");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

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
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    service: "lms-notify-backend",
    smtpConfigured: Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD),
    smtpPort: parseInt(process.env.SMTP_PORT || "2525", 10),
    environment: process.env.NODE_ENV || "production"
  });
};

app.get("/", getHealthStatus);
app.get("/health", getHealthStatus);
app.get("/api/health", getHealthStatus);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer upload configuration with security limits (max 10MB, Excel only)
const upload = multer({
  dest: "uploads/",
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

// In-memory status storage for the latest mail operation
let mailStatus = [];

// Configurable constants for email template
const subject = "Enhance Your Teaching Experience with Our Learning Platform";
const applicationLink = "https://lms-notify.example.com";
const supportEmail = "support@lms-notify.example.com";
const senderName = "LMS Notify Team";

// Configure global pooled Nodemailer transporter (Brevo SMTP)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp-relay.brevo.com",
  port: parseInt(process.env.SMTP_PORT || "2525", 10),
  secure: process.env.SMTP_SECURE === "true",
  requireTLS: true,
  pool: true,
  maxConnections: 3,
  maxMessages: 200,
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 60000,
  tls: {
    rejectUnauthorized: false
  },
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Helper to escape HTML characters to prevent XSS / HTML injection in emails
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Builds a professional HTML Newsletter compatible with Gmail & common email clients.
 * Uses XHTML 1.0 Transitional, 600px table layout, and inline CSS.
 */
function buildEmailHtml(name) {
  const recipientName = name ? escapeHtml(String(name).trim()) : "Educator";
  const currentYear = new Date().getFullYear();

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>Your Learning Platform</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: Arial, Helvetica, sans-serif; -webkit-font-smoothing: antialiased; width: 100% !important;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f6f8; padding: 40px 0;">
        <tr>
            <td align="center">
                <!-- Main Email Container (600px) -->
                <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);">
                    
                    <!-- Header -->
                    <tr>
                        <td align="center" bgcolor="#4F46E5" style="padding: 35px 20px; background-color: #4F46E5;">
                            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.5px; text-transform: uppercase;">
                                YOUR LEARNING PLATFORM
                            </h1>
                            <p style="color: #e0e7ff; margin: 6px 0 0 0; font-size: 14px; font-weight: 400;">
                                Making teaching and learning simpler.
                            </p>
                        </td>
                    </tr>

                    <!-- Main Content -->
                    <tr>
                        <td style="padding: 40px 35px; color: #334155; font-size: 15px; line-height: 1.6;">
                            
                            <!-- Personalized Greeting -->
                            <p style="margin-top: 0; margin-bottom: 20px; font-size: 16px; font-weight: 700; color: #1e293b;">
                                Hello ${recipientName},
                            </p>

                            <!-- Heading -->
                            <h2 style="color: #4F46E5; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 14px;">
                                Make Teaching More Simple &amp; Effective
                            </h2>

                            <!-- Introduction -->
                            <p style="margin-top: 0; margin-bottom: 16px; color: #475569;">
                                We are excited to introduce our learning platform, designed to make teaching and learning more organized, accessible, and convenient.
                            </p>

                            <p style="margin-top: 0; margin-bottom: 24px; color: #475569;">
                                Whether you are managing learning materials, sharing resources with students, or organizing your teaching activities, our platform brings everything together in one simple place.
                            </p>

                            <!-- Features List Section (Nested Table) -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; margin-bottom: 28px;">
                                <tr>
                                    <td>
                                        <p style="margin: 0 0 14px 0; font-weight: 700; color: #1e293b; font-size: 15px;">
                                            Key Features &amp; Benefits:
                                        </p>
                                        <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                                <td style="padding: 4px 0; color: #334155; font-size: 14px;">
                                                    <span style="color: #16a34a; font-weight: bold; margin-right: 8px;">✓</span> Organize teaching materials
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 4px 0; color: #334155; font-size: 14px;">
                                                    <span style="color: #16a34a; font-weight: bold; margin-right: 8px;">✓</span> Share learning content with students
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 4px 0; color: #334155; font-size: 14px;">
                                                    <span style="color: #16a34a; font-weight: bold; margin-right: 8px;">✓</span> Manage learning resources easily
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 4px 0; color: #334155; font-size: 14px;">
                                                    <span style="color: #16a34a; font-weight: bold; margin-right: 8px;">✓</span> Make teaching activities more convenient
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 4px 0; color: #334155; font-size: 14px;">
                                                    <span style="color: #16a34a; font-weight: bold; margin-right: 8px;">✓</span> Improve communication with students
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- Call-To-Action (CTA) Button -->
                            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 28px;">
                                <tr>
                                    <td align="center">
                                        <a href="${applicationLink}" target="_blank" style="background-color: #4F46E5; color: #ffffff; text-decoration: none; padding: 14px 30px; border-radius: 6px; font-weight: 700; font-size: 15px; display: inline-block; box-shadow: 0 2px 4px rgba(79, 70, 229, 0.25);">
                                            Explore the Platform
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <!-- Support Section -->
                            <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 20px; color: #64748b;">
                                <p style="margin: 0 0 6px 0; font-weight: 700; color: #1e293b; font-size: 14px;">Have questions?</p>
                                <p style="margin: 0; font-size: 14px; color: #475569;">
                                    If you would like to learn more about the platform, feel free to contact our team at 
                                    <a href="mailto:${supportEmail}" style="color: #4F46E5; text-decoration: underline;">${supportEmail}</a>.
                                </p>
                            </div>

                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td align="center" bgcolor="#f8fafc" style="background-color: #f8fafc; padding: 20px 35px; border-top: 1px solid #e2e8f0; color: #64748b; font-size: 13px; text-align: center;">
                            <p style="margin: 0 0 4px 0; font-weight: 700; color: #334155;">${senderName}</p>
                            <p style="margin: 0 0 8px 0; color: #64748b;">Making teaching and learning simpler.</p>
                            <p style="margin: 0; color: #94a3b8; font-size: 12px;">© ${currentYear} LMS Notify. All rights reserved.</p>
                        </td>
                    </tr>

                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

/**
 * Plain text fallback for non-HTML mail readers
 */
function buildEmailTextFallback(name) {
  const recipientName = name ? String(name).trim() : "Educator";
  return `Hello ${recipientName},

We are excited to introduce our learning platform, designed to make teaching and learning simpler and more organized.

Whether you are managing learning materials, sharing resources with students, or organizing your teaching activities, our platform brings everything together in one simple place.

Key Features & Benefits:
✓ Organize teaching materials
✓ Share learning content with students
✓ Manage learning resources easily
✓ Make teaching activities more convenient
✓ Improve communication with students

Explore the Platform:
${applicationLink}

Have questions? Contact us at: ${supportEmail}

Best Regards,
${senderName}`;
}

// Helper to map specific SMTP error codes to clear user-friendly messages
function getSmtpErrorMessage(err) {
  if (!err) return "Unknown SMTP error occurred.";
  const code = err.code || "";
  const response = String(err.response || "");
  const message = String(err.message || "");

  if (response.includes("525") || message.includes("525") || message.includes("Unauthorized IP address")) {
    return "Brevo Error (525): Unauthorized IP address. Go to Brevo > Settings > Security > Authorized IPs to whitelist your IP or deactivate IP blocking.";
  }
  if (code === "ETIMEDOUT" || message.includes("ETIMEDOUT")) {
    return "SMTP connection timed out (ETIMEDOUT). Your ISP/network may be blocking outbound port 587, or Brevo dropped the connection due to IP authorization.";
  }
  if (code === "ECONNREFUSED" || message.includes("ECONNREFUSED")) {
    return "SMTP connection refused (ECONNREFUSED). Check your SMTP host and port settings.";
  }
  if (code === "ENOTFOUND" || message.includes("ENOTFOUND")) {
    return "DNS error (ENOTFOUND): Unable to resolve SMTP hostname.";
  }
  if (code === "EAUTH" || response.includes("535") || message.includes("535")) {
    return "SMTP authentication failed (535/EAUTH). Please verify your Brevo login credentials in .env.";
  }
  return message || "Failed to communicate with SMTP server.";
}

// Helper to validate email format
function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email.trim());
}

/**
 * POST /send-mails
 * Accepts an Excel file (.xlsx), reads recipients, and sends individual personalized HTML emails.
 */
app.post("/send-mails", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "Please upload an Excel file."
    });
  }

  const filePath = req.file.path;
  const originalName = req.file.originalname || "";

  // Validate extension
  if (!originalName.toLowerCase().endsWith(".xlsx") && !originalName.toLowerCase().endsWith(".xls")) {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    return res.status(400).json({
      success: false,
      message: "Invalid file format. Please upload an .xlsx file."
    });
  }

  try {
    // Read Excel file using XLSX
    const workbook = XLSX.readFile(filePath);
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

    const results = [];
    let sentCount = 0;
    let failedCount = 0;

    // Send individual personalized HTML emails
    for (const row of data) {
      // Find case-insensitive keys for Name and Email (e.g. name, Name, NAME, email, Email, EMAIL)
      const rowKeys = Object.keys(row);
      const nameKey = rowKeys.find((k) => /^name$/i.test(k.trim())) || "Name";
      const emailKey = rowKeys.find((k) => /^email$/i.test(k.trim())) || "Email";

      const name = row[nameKey] ? String(row[nameKey]).trim() : "";
      const email = row[emailKey] ? String(row[emailKey]).trim() : "";

      // Validate presence of Name, Email, and Email format
      if (!name || !email || !isValidEmail(email)) {
        results.push({
          name: name || "N/A",
          email: email || "N/A",
          status: "Failed"
        });
        failedCount++;
        continue;
      }

      const emailHtml = buildEmailHtml(name);
      const emailText = buildEmailTextFallback(name);

      const fromAddress = process.env.MAIL_FROM || process.env.EMAIL_USER || "your-email@example.com";
      const mailOptions = {
        from: `"${senderName}" <${fromAddress}>`,
        to: email,
        subject: subject,
        text: emailText,
        html: emailHtml
      };

      try {
        await transporter.sendMail(mailOptions);
        results.push({
          name: name,
          email: email,
          status: "Success"
        });
        sentCount++;
      } catch (mailErr) {
        console.error(`Failed to send email to ${email}:`, mailErr.message);
        results.push({
          name: name,
          email: email,
          status: "Failed"
        });
        failedCount++;
      }
    }

    // Update in-memory status
    mailStatus = results;

    return res.json({
      success: true,
      message: "Mail sending completed",
      total: results.length,
      sent: sentCount,
      failed: failedCount,
      results: results
    });
  } catch (error) {
    console.error("Error processing Excel file:", error);
    return res.json({
      success: false,
      message: "Excel parsing or processing error: " + error.message
    });
  } finally {
    // Delete temporary uploaded file
    if (filePath && fs.existsSync(filePath)) {
      fs.unlink(filePath, (err) => {
        if (err) console.error("Failed to delete temp file:", err);
      });
    }
  }
});

/**
 * GET /status
 * Returns the results of the most recent mail-sending operation.
 */
app.get("/status", (req, res) => {
  const sent = mailStatus.filter((item) => item.status === "Success").length;
  const failed = mailStatus.filter((item) => item.status === "Failed").length;

  res.json({
    success: true,
    total: mailStatus.length,
    sent: sent,
    failed: failed,
    results: mailStatus
  });
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
const server = app.listen(PORT, async () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  if (process.env.EMAIL_USER && process.env.EMAIL_PASSWORD) {
    try {
      await transporter.verify();
      console.log(`SMTP connection verified successfully on port ${process.env.SMTP_PORT || "2525"}.`);
    } catch (err) {
      console.warn("SMTP verification notice:", getSmtpErrorMessage(err));
      if (err.message && !err.message.includes(getSmtpErrorMessage(err))) {
        console.warn("Raw SMTP info:", err.message);
      }
    }
  } else {
    console.log("Notice: EMAIL_USER / EMAIL_PASSWORD not provided in environment variables.");
  }
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Please stop the existing process or run with PORT=<another_port>.`);
  } else {
    console.error("Server error:", err.message);
  }
});