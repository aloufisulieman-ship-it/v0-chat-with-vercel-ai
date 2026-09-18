-- ============================================================================
-- 019 — عمود sort_order على safety_rules، وضبط قيمه لمواقع منشأة "شركة الأيادي
-- الفضية الحديثة" (MHS) التسعة الحالية. نسخة SQL خام جاهزة للّصق في Neon SQL
-- Editor — توازي scripts/019-safety-rules-sort-order.mjs (القابل للتشغيل بـ
-- node ... --dry) وتحمل نفس المنطق والقيم بالضبط، وتحقّقت من تطابقها بعد
-- تنفيذها فعلياً على قاعدة اختبار (تشغيل حقيقي + إعادة تشغيل لإثبات الثبات).
--
-- لا يُنشئ وحدة ولا جدولاً جديداً: يضيف عموداً واحداً لجدول safety_rules القائم.
--
-- التشغيل: انسخ القسم ①  (SELECT للمعاينة، بلا أي تعديل) وشغّله أولاً وتحقق
-- من ظهور مؤسسة واحدة بالضبط. بعد التأكد فقط، انسخ القسم ② (BEGIN...COMMIT)
-- وشغّله لتنفيذ الترحيل الفعلي.
-- ============================================================================


-- ═══════════════════════ ① SELECT المعاينة (بلا أي تعديل) ═══════════════════════
-- تحقّق من: مؤسسة واحدة مطابقة بالضبط، ووجود سجل بكل موقع من المواقع التسعة،
-- والقيمة المخطَّطة لكل منها. لا يفترض وجود عمود sort_order مسبقاً (هذا
-- السكربت هو من يضيفه في القسم ②)، فيبقى صالحاً للتشغيل قبل الترحيل مباشرة.

WITH target_org AS (
  SELECT DISTINCT o.id AS org_id, o.name AS org_name
    FROM organization o
    LEFT JOIN company c ON c."organizationId" = o.id
   WHERE o.name ILIKE '%الأيادي الفضية الحديثة%'
      OR c.name ILIKE '%الأيادي الفضية الحديثة%'
),
planned_order (location, sort_order) AS (
  VALUES
    ('الساحة — التحميل والتفريغ (العمال)', 1),
    ('الساحة — مسارات الرافعات الشوكية', 2),
    ('الساحة — مواقف الشاحنات (الزوار)', 3),
    ('الورشة — منطقة الإصلاح', 4),
    ('الورشة — منطقة الشحن الكهربائي (الرافعات والتوكتوك)', 5),
    ('الورشة — فنيو الورشة', 6),
    ('مخزن قطع الغيار ومكتب الورشة', 7),
    ('مكتب السلامة والعمليات ومكاتب الإدارة التنفيذية (مبنى الورشة)', 8),
    ('المكتب الرئيسي', 9)
)
SELECT
  (SELECT count(*) FROM target_org)         AS matching_orgs_count,
  (SELECT org_id FROM target_org LIMIT 1)   AS org_id,
  (SELECT org_name FROM target_org LIMIT 1) AS org_name,
  p.location,
  (sr.id IS NOT NULL)                       AS row_exists,
  p.sort_order                              AS planned_sort_order
FROM planned_order p
LEFT JOIN safety_rules sr
  ON sr."organizationId" = (SELECT org_id FROM target_org LIMIT 1)
 AND sr.location = p.location
ORDER BY p.sort_order;

-- تفسير الأعمدة:
--   matching_orgs_count = 1  إلزامي — إن كانت 0 أو أكثر من 1 فلا تُكمل، صحّح
--                              نمط الاسم أو حدّد المؤسسة يدوياً.
--   row_exists = false  يعني عدم وجود سجل بهذا الموقع بعد لهذه المؤسسة (لن
--                              يُحدَّث شيء له في القسم ②، ويبقى بلا قيمة حتى
--                              يُبذَر — راجع scripts/017).


-- ═══════════════════ ② BEGIN...COMMIT — التنفيذ الفعلي ═══════════════════
-- يوقف المعاملة تلقائياً (RAISE EXCEPTION) إن لم تكن هناك مؤسسة مطابقة واحدة
-- بالضبط، فلا خطر تعديل في مؤسسة خاطئة حتى بلا مراجعة القسم ① يدوياً.

BEGIN;

ALTER TABLE safety_rules ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE TEMP TABLE _sort_target ON COMMIT DROP AS
SELECT DISTINCT o.id AS org_id, o.name AS org_name
  FROM organization o
  LEFT JOIN company c ON c."organizationId" = o.id
 WHERE o.name ILIKE '%الأيادي الفضية الحديثة%'
    OR c.name ILIKE '%الأيادي الفضية الحديثة%';

DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM _sort_target;
  IF n = 0 THEN
    RAISE EXCEPTION 'لم توجد أي مؤسسة تطابق "الأيادي الفضية الحديثة" — تراجعت المعاملة، لم يُعدَّل شيء.';
  ELSIF n > 1 THEN
    RAISE EXCEPTION 'وُجدت أكثر من مؤسسة مطابقة (% مؤسسة) — حدّد المؤسسة يدوياً، تراجعت المعاملة.', n;
  END IF;
END $$;

CREATE TEMP TABLE _sort_order (location text, sort_order integer) ON COMMIT DROP;

INSERT INTO _sort_order (location, sort_order) VALUES
  ($r$الساحة — التحميل والتفريغ (العمال)$r$, 1),
  ($r$الساحة — مسارات الرافعات الشوكية$r$, 2),
  ($r$الساحة — مواقف الشاحنات (الزوار)$r$, 3),
  ($r$الورشة — منطقة الإصلاح$r$, 4),
  ($r$الورشة — منطقة الشحن الكهربائي (الرافعات والتوكتوك)$r$, 5),
  ($r$الورشة — فنيو الورشة$r$, 6),
  ($r$مخزن قطع الغيار ومكتب الورشة$r$, 7),
  ($r$مكتب السلامة والعمليات ومكاتب الإدارة التنفيذية (مبنى الورشة)$r$, 8),
  ($r$المكتب الرئيسي$r$, 9);

UPDATE safety_rules sr
   SET sort_order = so.sort_order, "updatedAt" = now()
  FROM _sort_order so, _sort_target t
 WHERE sr."organizationId" = t.org_id
   AND sr.location = so.location;

COMMIT;

-- تحقّق بعد التنفيذ:
-- SELECT location, sort_order FROM safety_rules
--  WHERE "organizationId" = (
--    SELECT id FROM organization WHERE name ILIKE '%الأيادي الفضية الحديثة%' LIMIT 1
--  )
--  ORDER BY sort_order;
