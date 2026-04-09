BEGIN;

DROP TABLE IF EXISTS "Attendance_new";
DROP TABLE IF EXISTS "NotificationLog_new";

CREATE TABLE "Attendance_new" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "studentName" TEXT,
  "studentId" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PRESENT',
  "time" TEXT,
  "notes" TEXT,
  "sessionId" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "Attendance_new"
  ADD CONSTRAINT "Attendance_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Attendance_new"
  ADD CONSTRAINT "Attendance_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "AttendanceSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "Attendance_new" (
  "id", "studentName", "studentId", "date", "status", "time", "notes", "sessionId", "createdAt", "updatedAt"
)
SELECT
  "id", "studentName", "studentId", "date", "status", "time", "notes", "sessionId", "createdAt", "updatedAt"
FROM "Attendance";

DROP TABLE "Attendance";
ALTER TABLE "Attendance_new" RENAME TO "Attendance";

CREATE UNIQUE INDEX "Attendance_studentId_date_key" ON "Attendance"("studentId", "date");
CREATE INDEX "Attendance_date_idx" ON "Attendance"("date");
CREATE INDEX "Attendance_studentId_idx" ON "Attendance"("studentId");
CREATE INDEX "Attendance_sessionId_idx" ON "Attendance"("sessionId");

CREATE TABLE "NotificationLog_new" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "studentName" TEXT,
  "phone" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "NotificationLog_new" (
  "id", "studentName", "phone", "message", "status", "provider", "createdAt"
)
SELECT
  "id", "studentName", "phone", "message", "status", "provider", "createdAt"
FROM "NotificationLog";

DROP TABLE "NotificationLog";
ALTER TABLE "NotificationLog_new" RENAME TO "NotificationLog";

COMMIT;
