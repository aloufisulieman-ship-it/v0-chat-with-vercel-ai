"use server";

import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireModuleUserId } from "@/lib/auth-helpers";

// ========== VIOLATIONS ==========

export async function getViolations() {
  const userId = await requireModuleUserId();

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  });

  if (!user) throw new Error("المستخدم غير موجود");

  if (
    user.role === "admin" ||
    user.department === "المدير العام" ||
    user.department === "مفتش السلامة"
  ) {
    return await db.query.violations.findMany({
      orderBy: [desc(schema.violations.createdAt)],
    });
  }

  return await db.query.violations.findMany({
    where: eq(schema.violations.userId, userId),
    orderBy: [desc(schema.violations.createdAt)],
  });
}

export async function createViolationFull(data: {
  violationType: string;
  severity: string;
  description: string;
  location: string;
  department: string;
  photoEvidence?: string;
  violatorSignature?: string;
  witnessSignature?: string;
  inspectorSignature?: string;
}) {
  const userId = await requireModuleUserId();

  // Auto-numbering VIO-YYYY-###
  const year = new Date().getFullYear();
  const existing = await db.query.violations.findMany();
  const count = existing.length + 1;
  const violationNumber = `VIO-${year}-${String(count).padStart(3, "0")}`;

  await db.insert(schema.violations).values({
    id: crypto.randomUUID(),
    violationNumber,
    userId,
    violationType: data.violationType,
    severity: data.severity,
    description: data.description,
    location: data.location,
    department: data.department,
    photoEvidence: data.photoEvidence ?? null,
    violatorSignature: data.violatorSignature ?? null,
    witnessSignature: data.witnessSignature ?? null,
    inspectorSignature: data.inspectorSignature ?? null,
    createdAt: new Date(),
  });

  return { violationNumber };
}

export async function deleteViolation(id: string) {
  const userId = await requireModuleUserId();

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, userId),
  });

  const violation = await db.query.violations.findFirst({
    where: eq(schema.violations.id, id),
  });

  if (!violation) throw new Error("المخالفة غير موجودة");

  const canDelete =
    user?.role === "admin" ||
    user?.department === "المدير العام" ||
    user?.department === "مفتش السلامة" ||
    violation.userId === userId;

  if (!canDelete) throw new Error("غير مصرح لك بالحذف");

  await db.delete(schema.violations).where(eq(schema.violations.id, id));
}
