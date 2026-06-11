"use server";

import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireModuleUserId } from "@/lib/session";

// ========== VIOLATIONS ==========

export async function getViolations() {
  const userId = await requireModuleUserId("violations");

  const user = await db.query.users.findFirst({
    where: eq(schema.user, userId),
  });

  if (!user) throw new Error("المستخدم غير موجود");

  if (
    user.role === "admin" ||
    user.department === "المدير العام" ||
    user.department === "مفتش السلامة"
  ) {
    return await db.query.violation.findMany({
      orderBy: [desc(schema.violation.createdAt)],
    });
  }

  return await db.query.violation.findMany({
    where: eq(schema.violation.userId, userId),
    orderBy: [desc(schema.violation.createdAt)],
  });
}

export async function createViolationFull(data: {
  employeeName: string;
  employeeNo?: string;
  companyName?: string;
  violationDate?: string;
  violationTime?: string;
  place?: string;
  description?: string;
  witnesses?: string;
  proposedAction?: string;
  editorSignature?: string;
  violatorSignature?: string;
  managerSignature?: string;
}) {
  const userId = await requireModuleUserId("violations");

  const year = new Date().getFullYear();
  const existing = await db.query.violation.findMany();
  const count = existing.length + 1;
  const documentNo = `MHS-IMS-PR-HSE-${String(count).padStart(3, "0")}`;

  await db.insert(schema.violation).values({
    userId,
    documentNo,
    employeeName: data.employeeName,
    employeeNo: data.employeeNo ?? "",
    companyName: data.companyName ?? "",
    violationDate: data.violationDate ?? null,
    violationTime: data.violationTime ?? "",
    place: data.place ?? "",
    description: data.description ?? "",
    witnesses: data.witnesses ?? "",
    proposedAction: data.proposedAction ?? "",
    editorSignature: data.editorSignature ?? "",
    violatorSignature: data.violatorSignature ?? "",
    managerSignature: data.managerSignature ?? "",
    status: "open",
    createdAt: new Date(),
  });

  return { documentNo };
}

export async function deleteViolation(id: number) {
  const userId = await requireModuleUserId("violations");

  const user = await db.query.users.findFirst({
    where: eq(schema.user.id, userId),
  });

  const violation = await db.query.violation.findFirst({
    where: eq(schema.violation.id, id),
  });

  if (!violation) throw new Error("المخالفة غير موجودة");

  const canDelete =
    user?.role === "admin" ||
    user?.department === "المدير العام" ||
    user?.department === "مفتش السلامة" ||
    violation.userId === userId;

  if (!canDelete) throw new Error("غير مصرح لك بالحذف");

  await db.delete(schema.violation).where(eq(schema.violation.id, id));
}
