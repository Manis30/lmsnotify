# LMS-Notify (Excel Mail Sender)

A full-stack web application designed to upload student data from Excel spreadsheets and send customized notification emails (such as marks, attendance, alerts, and feedback) in bulk via SMTP.

## Features

- **Excel Upload & Parsing**: Easily parse `.xlsx` and `.xls` files with student information.
- **Customizable Email Templates**: Dynamic placeholder tags to personalize emails for each student.
- **Batch Mail Sending**: Fast and reliable automated email delivery via Brevo / SMTP.
- **Modern Responsive UI**: Built with React and Vite for a seamless and responsive user experience.
- **Backend API**: Express.js server handling file parsing, mail delivery, and status tracking.

## Tech Stack

- **Frontend**: React, Vite, CSS, React Icons
- **Backend**: Node.js, Express, Multer, Nodemailer, SheetJS (`xlsx`), Dotenv

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm

### 1. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory based on `.env.example`:

```env
EMAIL_USER=your_smtp_user
EMAIL_PASSWORD=your_smtp_password
MAIL_FROM=your_email@example.com
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
PORT=5000
```

Start the backend server:

```bash
npm run dev
# or
npm start
```

The backend server runs on `http://localhost:5000`.

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend application runs on `http://localhost:5173`.

## License

MIT
