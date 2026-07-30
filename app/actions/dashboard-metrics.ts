"use server"

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { incident, permit, inspection, risk, observation } from "@/lib/db/schema"
import { and, count, eq, gte, isNull, lte, ne, or, sql } from "drizzle-orm"
import { headers } from "next/headers"

// معرّف المستخدم الحالي — كل الاستعلامات مقيّدة به (لا RLS في Neon).
async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error("Unauthorized")
  return session.user.id
}

// أول/آخر يوم في الشهر الحالي بصيغة YYYY-MM-DD.
function currentMonthRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { start: fmt(start), end: fmt(end) }
}

function toNumber(rows: { value: number }[]) {
  return Number(rows[0]?.value ?? 0)
}

/**
 * الحوادث المفتوحة: عدد سجلات الحوادث (incident) التي حالتها غير مغلقة.
 * (لا يوجد جدول forklift_accidents منفصل؛ جدول incident هو سجل الحوادث في النظام.)
 */
export async function getOpenIncidentsCount(): Promise<number> {
  const userId = await getUserId()
  const rows = await db
    .select({ value: count() })
    .from(incident)
    .where(and(eq(incident.userId, userId), ne(incident.status, "closed")))
  return toNumber(rows)
}

/**
 * التصاريح النشطة: التصاريح المعتمدة/السارية التي لم تنتهِ صلاحيتها بعد
 * (validTo فارغ أو تاريخه اليوم فأحدث).
 */
export async function getActivePermitsCount(): Promise<number> {
  const userId = await getUserId()
  const today = new Date().toISOString().slice(0, 10)
  const rows = await db
    .select({ value: count() })
    .from(permit)
    .where(
      and(
        eq(permit.userId, userId),
        or(eq(permit.status, "approved"), eq(permit.status, "active")),
        or(isNull(permit.validTo), gte(permit.validTo, today)),
      ),
    )
  return toNumber(rows)
}

/**
 * تصنيف ملاحظات نموذج التفتيش/الجولة الميدانية:
 *  - positive: الملاحظات الآمنة/الإيجابية (kind = "positive").
 *  - concerns: باقي الملاحظات (شبه حادثة/غير آمنة) (kind = "observation").
 */
export async function getObservationBreakdown(): Promise<{ positive: number; concerns: number }> {
  const userId = await getUserId()
  const [pos, con] = await Promise.all([
    db
      .select({ value: count() })
      .from(observation)
      .where(and(eq(observation.userId, userId), eq(observation.kind, "positive"))),
    db
      .select({ value: count() })
      .from(observation)
      .where(and(eq(observation.userId, userId), ne(observation.kind, "positive"))),
  ])
  return { positive: toNumber(pos), concerns: toNumber(con) }
}

/**
 * عمليات التفتيش: عدد التفتيشات المكتملة (status = completed) خلال الشهر الحالي،
 * اعتماداً على تاريخ التفتيش وإلا تاريخ الإنشاء.
 */
export async function getInspectionsThisMonthCount(): Promise<number> {
  const userId = await getUserId()
  const { start, end } = currentMonthRange()
  const refDate = sql`COALESCE(${inspection.inspectionDate}, ${inspection.createdAt}::date)`
  const rows = await db
    .select({ value: count() })
    .from(inspection)
    .where(
      and(
        eq(inspection.userId, userId),
        eq(inspection.status, "completed"),
        gte(refDate, start),
        lte(refDate, end),
      ),
    )
  return toNumber(rows)
}

/**
 * مخاطر عالية: سجلات المخاطر عالية الدرجة في مصفوفة المخاطر
 * (الاحتمالية × الشدة ≥ 9) مضافاً إليها ملاحظات شبه الحوادث/عالية الخطورة
 * من نموذج التفتيش الميداني (observation.kind = "observation").
 */
export async function getHighRiskCount(): Promise<number> {
  const userId = await getUserId()
  const [highRisks, nearMiss] = await Promise.all([
    db
      .select({ value: count() })
      .from(risk)
      .where(
        and(
          eq(risk.userId, userId),
          sql`(COALESCE(${risk.likelihood}, 1) * COALESCE(${risk.consequence}, 1)) >= 9`,
        ),
      ),
    db
      .select({ value: count() })
      .from(observation)
      .where(and(eq(observation.userId, userId), eq(observation.kind, "observation"))),
  ])
  return toNumber(highRisks) + toNumber(nearMiss)
}
