import "server-only"
import { db } from "@/lib/db"
import { organization } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

// الرسالة الموحّدة التي يردّها الخادم عند رفض تعديل مقفول من مدير المؤسسة. نصّها ثابت
// لأنه جزء من متطلبات المنتج (يُعرض كما هو في كل واجهة).
export const SETTINGS_LOCKED_MESSAGE =
  "تم قفل هذه الإعدادات بعد الإعداد الأولي. للتعديل، يرجى التواصل مع إدارة المنصّة."

// حالة قفل "الإعداد الأولي" لمؤسسة واحدة (معلومات المنشأة + إعدادات التشغيل).
export type SettingsLockState = { locked: boolean; unlockRequested: boolean }

// يقرأ حالة القفل لمؤسسة. مؤسسة بلا صف (نظرياً) تُعامَل كغير مقفولة.
export async function getSettingsLock(organizationId: string): Promise<SettingsLockState> {
  const [row] = await db
    .select({
      locked: organization.settingsLocked,
      unlockRequested: organization.settingsUnlockRequested,
    })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1)
  return { locked: row?.locked ?? false, unlockRequested: row?.unlockRequested ?? false }
}

// يقفل الإعدادات بعد أول حفظ ناجح من مدير المؤسسة. idempotent: استدعاؤه على مؤسسة
// مقفولة أصلاً لا يغيّر شيئاً. لا يُستدعى أبداً عندما يكون المُعدِّل مسؤول منصّة.
export async function lockSettings(organizationId: string): Promise<void> {
  await db
    .update(organization)
    .set({ settingsLocked: true, updatedAt: new Date() })
    .where(eq(organization.id, organizationId))
}
