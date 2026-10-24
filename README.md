# LMS-Notify (Excel Mail Sender)

A modern, production-grade email campaign and delivery tracking dashboard built with **React**, **Express**, **MongoDB Atlas**, and **Brevo Transactional API**. Upload student/recipient data from Excel spreadsheets, send personalized emails in bulk, and monitor real-time delivery events (requests, delivered, opened, clicked, bounced, blocked) directly from your dashboard.

---

## Architecture & Project Structure

```text
LMS-Notify/
├── backend/
│   ├── models/
│   │   ├── Campaign.js      # MongoDB schema for email campaigns
│   │   ├── Event.js         # MongoDB schema for deduped delivery events
│   │   └── Message.js       # MongoDB schema for recipient status tracking
│   ├── .env.example         # Template for backend environment variables
│   ├── .gitignore           # Backend git ignores
│   ├── package.json         # ES module backend manifest (Express, Mongoose, Multer, XLSX)
│   └── server.js            # Express server (in-memory parsing, Brevo integration, Mongo sync)
├── frontend/
│   ├── public/
│   │   ├── favicon.svg      # Custom Claude & Mail theme SVG favicon
│   │   └── sample_students.xlsx # Sample template for download
│   ├── src/
│   │   ├── App.css          # Modern SaaS dashboard styling & design system
│   │   ├── App.jsx          # React dashboard (Framer Motion, Lucide icons, live polling)
│   │   └── main.jsx         # React application entry point
│   ├── .env.example         # Template for frontend environment variables
│   ├── index.html           # HTML template
│   ├── package.json         # Frontend manifest (Vite, React, Framer Motion, Lucide)
│   └── vite.config.js       # Vite build configuration
├── .gitignore               # Root git ignore
└── README.md                # Project documentation
```

---

## Key Features

- **Stateless In-Memory Parsing**: Excel spreadsheets (`.xlsx`, `.xls`) are processed directly in-memory via `multer.memoryStorage()`, eliminating temporary disk files and ensuring compatibility with serverless, containerized, and read-only runtimes.
- **MongoDB Atlas Event Store**: Persistent tracking of campaigns, recipients, and deduplicated event logs (`Campaign`, `Message`, `Event` collections).
- **Live Brevo API Synchronization**: Every 12 seconds, the dashboard synchronizes live delivery status, open counts, link clicks, proxy opens, bounces, and blockages directly from Brevo's SMTP statistics API.
- **Interactive Event Timeline**: Click on any recipient row to inspect the full chronological timeline of delivery events including raw timestamps and client IP addresses.
- **Refined SaaS UI**: Built with modern typography, smooth animations via Framer Motion, Lucide React icons, and customizable filtering.

---

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm
- MongoDB Atlas cluster
- Brevo account and API Key

---

### 1. Backend Setup

```bash
cd backend
npm install
```

Copy `.env.example` to `.env` and fill in your credentials:

```bash
cp .env.example .env
```

Configuration variables:

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `PORT` | Backend server port | `5000` |
| `MONGODB_URI` | MongoDB Atlas connection string | `mongodb+srv://...` |
| `BREVO_API_KEY` | Brevo API v3 key | `xkeysib-...` |
| `MAIL_FROM` | Verified sender email address | `maninature121@gmail.com` |
| `SENDER_NAME` | Sender display name | `LMS Notify Team` |
| `CLIENT_URL` | Allowed frontend URLs for CORS | `http://localhost:3000,http://localhost:5173` |
| `EMAIL_SUBJECT` | Default subject line for emails | `Enhance Your Teaching Experience...` |
| `APPLICATION_LINK` | Action button link in email body | `https://lms-notify.example.com` |
| `SUPPORT_EMAIL` | Support contact email | `support@lms-notify.example.com` |

Start the backend server in development mode:

```bash
npm run dev
```

The server will start on `http://localhost:5000`.

---

### 2. Frontend Setup

```bash
cd frontend
npm install
```

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

```env
VITE_API_URL=http://localhost:5000
```

Start the frontend development server:

```bash
npm run dev
```

Open `http://localhost:3000` in your browser.

To create a production build:

```bash
npm run build
```

---

## License

MIT
