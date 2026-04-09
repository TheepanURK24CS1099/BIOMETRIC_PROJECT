# 🏠 Girls Hostel Biometric Attendance System

A production-ready web application for managing hostel attendance using biometric fingerprint simulation, with auto-absent marking and SMS parent notifications.

---

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router) + TypeScript |
| Styling | Tailwind CSS |
| Backend | Next.js API Routes (Node.js) |
| ORM | Prisma |
| Database | SQLite (dev) → PostgreSQL (prod) |
| Auth | JWT via `jose` + httpOnly cookies |
| SMS | Fast2SMS / Twilio (pluggable) |

---

## 📁 Project Structure

```
hostel-attendance/
├── prisma/
│   ├── schema.prisma          # DB models: Student, Attendance, Admin, NotificationLog
│   └── seed.ts                # Sample data seeder
│
├── src/
│   ├── app/
│   │   ├── layout.tsx         # Root layout with toast
│   │   ├── page.tsx           # Redirect to /attendance or /admin
│   │   │
│   │   ├── attendance/        # PUBLIC - Student scan station
│   │   │   └── page.tsx       # Biometric scan UI (tablet-friendly)
│   │   │
│   │   ├── admin/             # PROTECTED - Admin panel
│   │   │   ├── layout.tsx     # Auth guard + sidebar layout
│   │   │   ├── login/         # Login page
│   │   │   ├── dashboard/     # Stats, trends, recent activity
│   │   │   ├── students/      # Register / Edit / Deactivate students
│   │   │   └── attendance/    # View history, filter, export CSV
│   │   │
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── login/     # POST - authenticate admin
│   │       │   ├── logout/    # POST - clear cookie
│   │       │   └── me/        # GET - current session
│   │       ├── students/
│   │       │   ├── route.ts   # GET list / POST create
│   │       │   └── [id]/      # GET / PUT / DELETE by id
│   │       ├── attendance/
│   │       │   ├── route.ts       # GET records with filters
│   │       │   ├── scan/          # POST - core biometric endpoint
│   │       │   ├── stats/         # GET - dashboard stats + weekly trend
│   │       │   ├── auto-absent/   # POST - mark absent for day
│   │       │   └── export/        # GET - CSV / JSON export
│   │       └── upload/            # POST - photo upload
│   │
│   ├── components/
│   │   └── admin/
│   │       └── AdminSidebar.tsx
│   │
│   ├── lib/
│   │   ├── prisma.ts          # Prisma singleton
│   │   ├── auth.ts            # JWT sign/verify helpers
│   │   ├── sms.ts             # SMS service (Fast2SMS / Twilio / Mock)
│   │   ├── auto-absent.ts     # Auto-absent job logic
│   │   └── utils.ts           # Shared helpers
│   │
│   ├── middleware.ts           # Route protection
│   └── types/index.ts         # TypeScript interfaces
│
├── public/uploads/            # Student photos
├── .env.example
└── README.md
```

---

## ⚡ Quick Start

### 1. Clone & Install

```bash
git clone <your-repo>
cd hostel-attendance
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env
# Edit .env with your values
```

### 3. Database Setup

```bash
npm run db:push       # Create SQLite database
npm run db:seed       # Seed admin + sample students
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## 🔐 Default Credentials

| Field | Value |
|-------|-------|
| Username | `admin` |
| Password | `admin123` |

> ⚠️ **Change the password in production!** Use Prisma Studio or update the seed.

---

## 📱 Pages & Routes

| URL | Access | Description |
|-----|--------|-------------|
| `/` | Public | Redirects to scan station or admin |
| `/attendance` | Public | **Biometric scan station** (tablet-friendly) |
| `/admin/login` | Public | Admin login |
| `/admin/dashboard` | Admin | Stats, trends, recent scans |
| `/admin/students` | Admin | Register, edit, deactivate students |
| `/admin/attendance` | Admin | View history, filter, export CSV |

---

## 🔌 API Reference

### Auth
```
POST /api/auth/login        { username, password } → sets auth cookie
POST /api/auth/logout       Clears auth cookie
GET  /api/auth/me           Returns current admin info
```

### Students
```
GET  /api/students          ?search=&page=&limit=   → paginated list
POST /api/students          { name, roomNumber, parentPhone, fingerprintId }
GET  /api/students/:id      Student + last 30 attendance records
PUT  /api/students/:id      Update any field
DEL  /api/students/:id      Soft-delete (isActive=false)
```

### Attendance
```
GET  /api/attendance             ?date=&status=&page= → filtered records
POST /api/attendance/scan        { fingerprintId }    → mark attendance
GET  /api/attendance/stats       ?date=              → dashboard data
POST /api/attendance/auto-absent { date? }           → mark all absent
GET  /api/attendance/export      ?from=&to=&format=  → CSV download
```

### Upload
```
POST /api/upload    multipart/form-data { photo: File } → { photoUrl }
```

---

## 🔄 Attendance Workflow

```
Student enters Fingerprint ID
        ↓
POST /api/attendance/scan
        ↓
   Find student by fingerprintId
        ↓
  Check: already marked today?
     ↙ YES            ↘ NO
Return 409        Determine status:
(already)     time < cutoff → PRESENT
              time > cutoff → LATE
                     ↓
          Create Attendance record
                     ↓
        Send SMS to parent (async)
                     ↓
          Return success + student info
```

---

## 📲 SMS Integration

The SMS service in `src/lib/sms.ts` supports three providers:

### Mock (Development)
```env
SMS_PROVIDER=mock
```
Logs messages to console — no real SMS sent.

### Fast2SMS (India — Recommended)
```env
SMS_PROVIDER=fast2sms
FAST2SMS_API_KEY=your_key_here
```
Sign up at [fast2sms.com](https://fast2sms.com) — free tier available.

### Twilio (International)
```env
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxx
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890
```

---

## ⏰ Auto-Absent Setup

### Option 1: Manual Trigger (Admin Dashboard)
Click **"Mark Auto-Absent"** button on the dashboard.

### Option 2: Vercel Cron
Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/attendance/auto-absent",
    "schedule": "0 22 * * *"
  }]
}
```
Set `CRON_SECRET` env var and pass it as `x-cron-secret` header.

### Option 3: Node Cron (Render / VPS)
```js
// cron.js
const cron = require('node-cron')
cron.schedule('0 22 * * *', async () => {
  await fetch('http://localhost:3000/api/attendance/auto-absent', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cron-secret': process.env.CRON_SECRET,
    },
    body: '{}',
  })
})
```

---

## 🔬 Hardware Biometric Integration

When a real fingerprint scanner is available, replace the text input in the scan station with SDK output:

```typescript
// src/app/attendance/page.tsx
// CURRENT (simulation):
const fingerprintId = inputRef.current?.value

// FUTURE (hardware SDK - e.g., Mantra, SecuGen, Futronic):
import { FingerprintSDK } from 'your-sdk'
const sdk = new FingerprintSDK()
sdk.onScan((template) => {
  // SDK returns template or matched ID from device
  const fingerprintId = sdk.matchTemplate(template)  // or device returns ID directly
  fetch('/api/attendance/scan', {
    method: 'POST',
    body: JSON.stringify({ fingerprintId }),
  })
})
```

The backend `/api/attendance/scan` endpoint remains **unchanged** — only the client-side input method changes.

---

## 🗄️ Database Models

### Student
```prisma
id            String   @id @default(cuid())
name          String
roomNumber    String
parentPhone   String
fingerprintId String   @unique
photoUrl      String?
isActive      Boolean  @default(true)
createdAt     DateTime @default(now())
```

### Attendance
```prisma
id        String           @id @default(cuid())
studentId String
date      String           // "2024-03-15"
status    AttendanceStatus // PRESENT | ABSENT | LATE
time      String?          // "21:30:00"
notes     String?
```

---

## 🚀 Production Deployment

### Render (Recommended for SQLite → upgrade to PostgreSQL)

1. Push to GitHub
2. Create new Web Service on Render
3. Set build command: `npm run build`
4. Set start command: `npm start`
5. Add environment variables from `.env.example`
6. For PostgreSQL, change `DATABASE_URL` to Render's Postgres URL and update `schema.prisma` provider to `postgresql`

### Vercel

1. Push to GitHub
2. Import to Vercel
3. Add environment variables
4. Deploy

> ⚠️ Vercel doesn't support SQLite in production (serverless). Use Vercel Postgres, Supabase, or PlanetScale.

---

## 🔒 Security Checklist

- [x] JWT in httpOnly cookie (XSS protected)
- [x] Bcrypt password hashing
- [x] Admin-only API routes via middleware
- [x] Soft-delete for students (data preserved)
- [x] Input validation on all endpoints
- [x] File type & size validation for uploads
- [ ] Rate limiting (add `express-rate-limit` or Vercel middleware)
- [ ] HTTPS in production (handled by Render/Vercel)
- [ ] Change default admin password

---

## 🛠️ Useful Commands

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run db:push      # Sync schema to database
npm run db:seed      # Seed sample data
npm run db:studio    # Open Prisma Studio (DB GUI)
npm run db:migrate   # Run migrations
```

---

## 📞 Support

Built for hostel management with ❤️. Ready for hardware biometric integration.

**Sample Fingerprint IDs (from seed):** FP001, FP002, FP003, FP004, FP005
