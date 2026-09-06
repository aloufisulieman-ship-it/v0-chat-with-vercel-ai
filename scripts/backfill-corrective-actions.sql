-- ترحيل لمرة واحدة (قابل لإعادة التشغيل بأمان / idempotent):
-- ينشئ إجراءات تصحيحية (CAPA) للسجلات الحرجة/العالية الحالية التي لا يرتبط بها أي
-- إجراء تصحيحي (بالربط المنظّم sourceType/sourceId أو النصّي القديم عبر رقم الوثيقة).
--
-- القواعد (مطابقة للربط التلقائي في app/actions/hse.ts، ISO 45001 §10.2):
--   • حادث بخطورة high/critical
--   • خطر بدرجة (likelihood × consequence) ≥ 15
--   • كل مخالفة (عدم مطابقة)
--
-- الترقيم: CAPA-YYYY-### تسلسلي مستقل لكل مؤسسة، يبدأ بعد أعلى رقم قائم لنفس السنة.
-- المسؤول الافتراضي: مدير السلامة (admin/manager أو قسم "مفتش السلامة"/"المدير العام").
-- تاريخ الاستحقاق: حرجة +7 أيام، عالية +14، غير ذلك +30 من اليوم.

BEGIN;

WITH
-- مدير السلامة الافتراضي لكل مؤسسة (أول مطابق حسب أولوية الدور/القسم).
default_manager AS (
  SELECT DISTINCT ON (u."organizationId")
    u."organizationId" AS org,
    u.name AS manager_name
  FROM "user" u
  WHERE u."organizationId" IS NOT NULL
  ORDER BY u."organizationId",
    CASE
      WHEN u.role = 'admin' THEN 0
      WHEN u.role = 'manager' THEN 1
      WHEN u.department = 'مفتش السلامة' THEN 2
      WHEN u.department = 'المدير العام' THEN 3
      ELSE 9
    END
),
-- أعلى تسلسل CAPA قائم لكل مؤسسة في السنة الحالية (نكمل بعده).
seq_base AS (
  SELECT
    a."organizationId" AS org,
    COALESCE(MAX(CAST(split_part(a.code, '-', 3) AS integer)), 0) AS max_seq
  FROM corrective_action a
  WHERE a.code LIKE 'CAPA-' || to_char(now(), 'YYYY') || '-%'
  GROUP BY a."organizationId"
),
-- السجلات المرشّحة للترحيل (مصدر موحّد): حوادث + مخاطر + مخالفات.
candidates AS (
  -- الحوادث عالية/حرجة
  SELECT
    i."organizationId" AS org,
    i."userId"         AS user_id,
    'incident'         AS source_type,
    i.id               AS source_id,
    'معالجة حادث: ' || i.title AS title,
    CASE WHEN i.severity = 'critical' THEN 'critical' ELSE 'high' END AS priority,
    'حادث ' || COALESCE(NULLIF(i."documentNo", ''), i.id::text) AS source_label,
    i."createdAt"      AS created_at
  FROM incident i
  WHERE i.severity IN ('high', 'critical')
    AND COALESCE(i.lifecycle_status, '') <> 'cancelled'
    AND NOT EXISTS (
      SELECT 1 FROM corrective_action a
      WHERE a."organizationId" = i."organizationId"
        AND a.status NOT IN ('cancelled', 'ملغي', 'ملغى', 'ملغاة')
        AND (
          (a."sourceType" = 'incident' AND a."sourceId" = i.id)
          OR (COALESCE(i."documentNo", '') <> '' AND a.source ILIKE '%' || i."documentNo" || '%')
        )
    )

  UNION ALL

  -- المخاطر بدرجة ≥ 15
  SELECT
    r."organizationId",
    r."userId",
    'risk',
    r.id,
    'ضبط خطر: ' || r.hazard,
    CASE WHEN COALESCE(r.likelihood,1) * COALESCE(r.consequence,1) >= 20 THEN 'critical' ELSE 'high' END,
    'الخطر: ' || r.hazard,
    r."createdAt"
  FROM risk r
  WHERE COALESCE(r.likelihood,1) * COALESCE(r.consequence,1) >= 15
    AND COALESCE(r.status, '') <> 'closed'
    AND NOT EXISTS (
      SELECT 1 FROM corrective_action a
      WHERE a."organizationId" = r."organizationId"
        AND a.status NOT IN ('cancelled', 'ملغي', 'ملغى', 'ملغاة')
        AND (
          (a."sourceType" = 'risk' AND a."sourceId" = r.id)
          OR a."riskId" = r.id
        )
    )

  UNION ALL

  -- المخالفات (كل مخالفة = عدم مطابقة)
  SELECT
    v."organizationId",
    v."userId",
    'violation',
    v.id,
    'معالجة مخالفة: ' || COALESCE(NULLIF(v."violationType", ''), v."employeeName"),
    'high',
    'مخالفة ' || COALESCE(NULLIF(v."documentNo", ''), v.id::text),
    v."createdAt"
  FROM violation v
  WHERE NOT EXISTS (
    SELECT 1 FROM corrective_action a
    WHERE a."organizationId" = v."organizationId"
      AND a.status NOT IN ('cancelled', 'ملغي', 'ملغى', 'ملغاة')
      AND a."sourceType" = 'violation' AND a."sourceId" = v.id
  )
),
-- ترقيم متسلسل داخل كل مؤسسة (يبدأ بعد أعلى رقم قائم)، بترتيب ثابت حسب تاريخ الإنشاء.
numbered AS (
  SELECT
    c.*,
    COALESCE(sb.max_seq, 0)
      + ROW_NUMBER() OVER (PARTITION BY c.org ORDER BY c.created_at, c.source_type, c.source_id)
      AS seq
  FROM candidates c
  LEFT JOIN seq_base sb ON sb.org = c.org
)
INSERT INTO corrective_action
  ("userId", "organizationId", code, title, source, "sourceType", "sourceId",
   "assignedTo", priority, status, "dueDate", "createdAt")
SELECT
  n.user_id,
  n.org,
  'CAPA-' || to_char(now(), 'YYYY') || '-' || lpad(n.seq::text, 3, '0'),
  n.title,
  n.source_label,
  n.source_type,
  n.source_id,
  COALESCE(dm.manager_name, ''),
  n.priority,
  'open',
  (now()::date + CASE WHEN n.priority = 'critical' THEN 7 WHEN n.priority = 'high' THEN 14 ELSE 30 END),
  now()
FROM numbered n
LEFT JOIN default_manager dm ON dm.org = n.org;

COMMIT;
