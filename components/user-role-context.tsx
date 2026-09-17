"use client"

import { createContext, useContext, type ReactNode } from "react"
import { isAuditor } from "@/lib/permissions"

// دور المستخدم الحالي متاحاً لكل مكوّنات العميل تحت AppShell، دون تمريره يدوياً
// عبر كل صفحة. يُستخدم لإخفاء أدوات الكتابة عمّن لا يملكها — والمنع الفعلي يبقى
// على الخادم في assertWritable، فالإخفاء تحسين تجربة لا حاجز أمان.
const UserRoleContext = createContext<string>("")

export function UserRoleProvider({ role, children }: { role: string; children: ReactNode }) {
  return <UserRoleContext.Provider value={role}>{children}</UserRoleContext.Provider>
}

export function useUserRole(): string {
  return useContext(UserRoleContext)
}

// المدقق: قراءة وتوقيع فقط، فلا تُعرض له أزرار الإضافة والتعديل والحذف.
export function useIsAuditor(): boolean {
  return isAuditor(useUserRole())
}
