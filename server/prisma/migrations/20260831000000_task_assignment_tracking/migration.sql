-- Mark a status/column as a "Done" column so completed-vs-pending counts are well defined
ALTER TABLE "TaskStatus" ADD COLUMN "isDone" BOOLEAN NOT NULL DEFAULT false;

-- Track who most recently assigned a task, and when
ALTER TABLE "Task" ADD COLUMN "assignedById" INTEGER;
ALTER TABLE "Task" ADD COLUMN "assignedAt" TIMESTAMP(3);

ALTER TABLE "Task" ADD CONSTRAINT "Task_assignedById_fkey"
  FOREIGN KEY ("assignedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: treat existing task creator as the original assigner, and any
-- column literally named "Done"/"Completed" as a done-column, so existing data
-- isn't blank after upgrading.
UPDATE "Task" SET "assignedById" = "createdById", "assignedAt" = "createdAt" WHERE "assigneeId" IS NOT NULL;
UPDATE "TaskStatus" SET "isDone" = true WHERE lower("name") IN ('done', 'completed', 'complete');
