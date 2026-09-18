// 017 — بذر قواعد السلامة (safety_rules) للمواقع التسعة، لمنشأة "شركة الأيادي
// الفضية الحديثة" (MHS) فقط. لا يُنشئ وحدة ولا جدولاً جديداً: يستخدم جدول
// safety_rules القائم الذي تقرأه صفحة /safety-rules (app/actions/equipment.ts:
// getSafetyRules/createSafetyRule) ويستهلكه المراقبة الذكية بالضبط
// (app/actions/ai-recognition.ts: getSafetyRulesForLocation).
//
// يضيف أولاً عمود camera_rules (IF NOT EXISTS، آمن لإعادة التشغيل) — نفس العمود
// المضاف في lib/db/schema.ts (safetyRule.cameraRules) — لتمييز القواعد القابلة
// للرصد بكاميرا مراقبة سلوك ظاهر في إطار واحد (PPE، مسافات، سرعة، وضعية معدة،
// دخان...) عن القواعد الإدارية غير المرئية في الصورة (حضور تدريب، تسجيل صيانة،
// صلاحية تصريح/شهادة كفاءة، فحص دوري موثّق...). rules يبقى النص الكامل كما
// كُتب (للعرض في الصفحة)؛ cameraRules نص فرعي يُستخدم فعلياً في تحكيم الذكاء
// الاصطناعي بدل rules الكامل (راجع التغيير في app/actions/ai-recognition.ts).
//
// نطاق التشغيل: مؤسسة واحدة فقط، محدَّدة بالاسم لا بمعرّف مُدخَل يدوياً — يبحث
// السكربت عن أول مؤسسة تطابق "الأيادي الفضية الحديثة" في organization.name أو
// company.name، ويتوقف بخطأ واضح إن لم يجد مطابقة واحدة حصراً (لا صفر ولا أكثر
// من مؤسسة) حتى لا يُدرِج بيانات في مؤسسة خاطئة.
//
// السجلات تُنسَب لأقدم حساب admin في تلك المؤسسة (owner)، لأن getSafetyRules
// الحالية تُصفّي بـ userId إضافة إلى organizationId (لا تستخدم scopeWhere التي
// تُظهر كل سجلات المؤسسة للمدراء) — ملاحظة مهمة: يعني هذا أن الصفحة ستُظهر
// القواعد المبذورة لهذا المستخدم تحديداً فقط، لا لكل مدير/مشرف في المؤسسة، ما
// لم تُعدَّل getSafetyRules لاحقاً لتستخدم scopeWhere كبقية سجلات النظام.
//
// إعادة التشغيل آمنة: يحذف صفوف هذه المؤسسة بنفس أسماء المواقع التسعة قبل
// الإدراج (بذر لا تراكم)، ولا يلمس أي صف بموقع آخر أو مؤسسة أخرى.
//
// الاستخدام:
//   node scripts/017-seed-safety-rules-mhs.mjs --dry   يعرض فقط: المؤسسة
//                                                       والمستخدم المالك
//                                                       المُحلَّين، وعدد
//                                                       الصفوف الحالية بهذه
//                                                       المواقع، وجدول
//                                                       بالمواقع التسعة
//                                                       المخطَّط بذرها —
//                                                       بلا أي تعديل.
//   node scripts/017-seed-safety-rules-mhs.mjs         ينفّذ البذر فعلياً.
import { Pool } from "pg"

const DRY = process.argv.includes("--dry")
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// اسم المؤسسة المستهدفة — تطابق جزئي (ILIKE) في organization.name أو company.name
// حتى لا يفشل التطابق بفارق "شركة" أو مسافات.
const ORG_NAME_PATTERN = "%الأيادي الفضية الحديثة%"

// كل عنصر: [نص القاعدة, رصدها بالكاميرا ممكن؟]. الرقم في النص هو رقمها الأصلي
// كما وردت، فتبقى قابلة للمطابقة مع القائمة الكاملة رغم أن cameraRules يستبعد
// بعض الأرقام (فجوات في الترقيم — لا تُربك نموذج الرؤية، فهو يقرأ نصاً لا فهرساً).
const LOCATIONS = [
  {
    location: "الساحة — التحميل والتفريغ (العمال)",
    items: [
      ["السترة العاكسة وحذاء السلامة إلزاميان طوال الوقت.", true],
      ["المشي في ممرات المشاة والعبور من المعابر المخططة فقط.", true],
      ["ممنوع الوقوف أو المرور خلف رافعة تعمل أو تحت حمولة مرفوعة.", true],
      ["تواصل بصري مع السائق قبل الاقتراب، ومسافة أمان 3 أمتار على الأقل.", true],
      ["ممنوع الركوب على الرافعة أو على الشوكات.", true],
      ["الرفع اليدوي حتى 25 كجم للفرد، وما زاد بمساعدة زميل أو معدة.", true],
      ["حضور حديث الأمان (Toolbox Talk) حسب الجدول.", false],
      ["ممنوع استخدام الهاتف أثناء العمل في الساحة.", true],
      ["الإبلاغ الفوري عن أي حادث أو حالة وشيكة.", false],
    ],
  },
  {
    location: "الساحة — مسارات الرافعات الشوكية",
    items: [
      ["القيادة لحاملي تصريح القيادة الداخلي الساري فقط.", false],
      ["فحص ما قبل التشغيل يومياً وتسجيله.", false],
      ["حد السرعة 10 كم/س في الساحة و5 كم/س عند المعابر ومناطق المشاة.", true],
      ["حزام الأمان إلزامي.", true],
      ["الشوكات منخفضة 10–15 سم أثناء السير.", true],
      ["القيادة للخلف عندما تحجب الحمولة الرؤية.", true],
      ["توقف تام واستخدام البوق عند التقاطعات والمعابر.", true],
      ["ممنوع حمل أي راكب.", true],
      ["ممنوع تجاوز الحمولة المقررة للرافعة.", false],
      ["عند الوقوف: الشوكات على الأرض، فرامل اليد، إطفاء المحرك، نزع المفتاح.", true],
      ["ممنوع استخدام الهاتف أثناء الحركة؛ استلام أوامر GLS عند التوقف فقط.", true],
    ],
  },
  {
    location: "الساحة — مواقف الشاحنات (الزوار)",
    items: [
      ["الالتزام بحد السرعة 10 كم/س واتجاهات السير.", true],
      ["الوقوف في الأماكن المخصصة فقط، وممنوع إغلاق مسارات الرافعات أو الممرات أو مخارج الطوارئ.", true],
      ["أثناء التحميل: إطفاء المحرك، فرامل اليد، ووضع مصدات العجلات.", true],
      ["السائق والمرافقون ينتظرون في المنطقة الآمنة المحددة، وممنوع التواجد بجانب الشاحنة أثناء عمل الرافعة.", true],
      ["السترة العاكسة إلزامية عند النزول من المركبة.", true],
      ["ممنوع الرجوع للخلف بدون موجّه.", true],
      ["ممنوع تجول الأطفال في الساحة.", true],
      ["التدخين في الأماكن المخصصة فقط.", true],
      ["المخالفات تُسجّل على رقم اللوحة وتُحال للجهة المختصة.", false],
    ],
  },
  {
    location: "الورشة — منطقة الإصلاح",
    items: [
      ["الدخول للمصرّح لهم فقط.", false],
      ["عزل الطاقة وقفلها ووسمها (LOTO) قبل أي إصلاح.", true],
      ["ممنوع العمل تحت معدة مرفوعة بالرافعة الهيدروليكية وحدها؛ حوامل ثابتة إلزامية.", true],
      ["اللحام والقطع بتصريح عمل ساخن، مع طفاية وحارس حريق، وإبعاد المواد القابلة للاشتعال 11 متراً.", true],
      ["الدهان في منطقة مهواة مخصصة مع قناع تنفس مناسب.", true],
      ["تنظيف انسكابات الزيت والوقود فوراً.", true],
      ["المواد القابلة للاشتعال في خزانة مخصصة.", true],
      ["الطفايات في أماكنها وصالحة، ومخارج الطوارئ غير مغلقة.", true],
      ["فحص الأدوات الكهربائية قبل الاستخدام.", false],
      ["اختبار المعدة بعد الإصلاح في منطقة محددة قبل إعادتها للخدمة وتسجيلها.", false],
    ],
  },
  {
    location: "الورشة — منطقة الشحن الكهربائي (الرافعات والتوكتوك)",
    items: [
      ["الشحن في المنطقة المخصصة فقط مع ترك مسافة بين المعدات.", true],
      ["استخدام شواحن المصنّع المعتمدة لكل نوع بطارية فقط.", false],
      ["فحص الكابلات والمقابس قبل التوصيل.", false],
      ["ممنوع شحن بطارية منتفخة أو تالفة أو ساخنة أو بها تسرب؛ تُعزل ويُبلَّغ عنها فوراً.", true],
      ["ممنوع التدخين واللهب واللحام في منطقة الشحن.", true],
      ["طفايات حسب توصية مصنّع البطارية قريبة وصالحة.", false],
      ["إيقاف الشاحن قبل فصل الموصل.", false],
      ["الأرضية جافة والتهوية جيدة.", true],
      ["عند دخان أو حرارة غير طبيعية من بطارية: إخلاء المنطقة والاتصال بالدفاع المدني.", true],
    ],
  },
  {
    location: "الورشة — فنيو الورشة",
    items: [
      ["معدات الوقاية حسب المهمة: حذاء سلامة، ملابس عمل، نظارات، قفازات، واقي وجه عند اللحام، سدادات أذن.", true],
      ["ممنوع الملابس الفضفاضة والمجوهرات قرب الأجزاء الدوارة.", true],
      ["العمل على أنظمة البطاريات للفني المدرب فقط، بقفازات عازلة.", false],
      ["ممنوع العمل منفرداً في المهام الخطرة.", true],
      ["تسجيل كل إصلاح في سجل الصيانة.", false],
      ["الإبلاغ عن الأعطال والحالات الوشيكة.", false],
      ["حضور التدريبات المقررة.", false],
    ],
  },
  {
    location: "مخزن قطع الغيار ومكتب الورشة",
    items: [
      ["الأثقل في الرفوف السفلى، وحمولة كل رف موضحة وغير متجاوزة.", true],
      ["الرفوف مثبتة.", false],
      ["استخدام سلم آمن؛ ممنوع التسلق على الرفوف.", true],
      ["الممرات خالية دائماً.", true],
      ["الزيوت والكيميائيات في منطقة مخصصة مع صحائف بيانات السلامة (SDS) وأحواض احتواء.", false],
      ["ممنوع تخزين البطاريات التالفة داخل المخزن.", true],
      ["طفاية حريق ومخرج واضح وإضاءة كافية.", true],
    ],
  },
  {
    location: "مكتب السلامة والعمليات ومكاتب الإدارة التنفيذية (مبنى الورشة)",
    items: [
      ["الوصول للمكاتب عبر ممر آمن محدد دون المرور بمنطقة عمل الورشة.", true],
      ["الزوار يُسجَّلون ويرافقهم موظف.", false],
      ["مخارج الطوارئ ومسارات الإخلاء واضحة وخريطة الإخلاء معلقة.", true],
      ["ممنوع تحميل المقابس، وإطفاء الأجهزة بعد الدوام.", true],
      ["حقيبة إسعافات أولية ومسعف معتمد متواجد.", false],
      ["كواشف دخان وإنذار حريق فعالة.", false],
      ["ممنوع التخزين في الممرات.", true],
      ["المشاركة في تمارين الإخلاء.", false],
      ["بيئة عمل مريحة (كرسي وشاشة بوضعية سليمة).", true],
    ],
  },
  {
    location: "المكتب الرئيسي",
    items: [
      ["سجل زوار ومرافقة الزائر.", false],
      ["مخارج الطوارئ واضحة وخريطة الإخلاء معلقة.", true],
      ["تمرين إخلاء دوري.", false],
      ["فحص الطفايات شهرياً.", false],
      ["حقيبة إسعافات أولية مجهزة.", true],
      ["ممنوع تحميل المقابس، والأسلاك مرتبة بعيداً عن الممرات.", true],
      ["بيئة عمل مريحة.", true],
      ["المشي في ممرات المشاة في موقف السيارات.", true],
      ["الإبلاغ عن أي خطر أو حالة وشيكة عبر رقيب.", false],
    ],
  },
]

// يبني نص rules الكامل (كل القواعد مرقّمة) ونص cameraRules الفرعي (المرصودة
// بالكاميرا فقط، بنفس أرقامها الأصلية — فجوات الترقيم مقصودة وغير مربكة لنموذج
// نصّي) من مصدر واحد (items) بدل كتابتهما منفصلين، فلا يمكن أن ينحرف أحدهما عن الآخر.
function buildTexts(items) {
  const numbered = items.map(([text], i) => `${i + 1}. ${text}`)
  const cameraOnly = items.map(([text], i) => [i, text]).filter(([i]) => items[i][1])
  return {
    rules: numbered.join("\n"),
    cameraRules: cameraOnly.map(([i, text]) => `${i + 1}. ${text}`).join("\n"),
  }
}

const SEED_LOCATIONS = LOCATIONS.map((l) => l.location)

async function resolveTarget(c) {
  const { rows } = await c.query(
    `select distinct o.id as org_id, o.name as org_name
       from organization o
       left join company c on c."organizationId" = o.id
      where o.name ilike $1 or c.name ilike $1`,
    [ORG_NAME_PATTERN],
  )
  if (rows.length === 0) {
    throw new Error(`لم توجد أي مؤسسة تطابق "${ORG_NAME_PATTERN}" — لم يُدرَج شيء.`)
  }
  if (rows.length > 1) {
    throw new Error(
      `وُجدت أكثر من مؤسسة مطابقة (${rows.map((r) => `${r.org_name} [${r.org_id}]`).join("، ")}) — ` +
        `حدّد المؤسسة يدوياً قبل المتابعة، لم يُدرَج شيء.`,
    )
  }
  const org = rows[0]

  const { rows: userRows } = await c.query(
    `select id, name, email
       from "user"
      where "organizationId" = $1 and role = 'admin'
      order by "createdAt" asc
      limit 1`,
    [org.org_id],
  )
  if (!userRows[0]) {
    throw new Error(`لا يوجد حساب admin في مؤسسة "${org.org_name}" [${org.org_id}] — لم يُدرَج شيء.`)
  }
  return { orgId: org.org_id, orgName: org.org_name, owner: userRows[0] }
}

async function main() {
  const c = await pool.connect()
  try {
    const { orgId, orgName, owner } = await resolveTarget(c)

    if (DRY) {
      const { rows: existing } = await c.query(
        `select location from safety_rules where "organizationId" = $1 and location = any($2::text[])`,
        [orgId, SEED_LOCATIONS],
      )
      console.log(`017 --dry — لم يُعدَّل شيء.`)
      console.log(`المؤسسة: ${orgName}  [${orgId}]`)
      console.log(`المستخدم المالك (owner): ${owner.name} <${owner.email}>  [${owner.id}]`)
      console.log(`صفوف قائمة مسبقاً بنفس المواقع التسعة سيُعاد إنشاؤها: ${existing.length}`)
      console.table(
        LOCATIONS.map((l) => {
          const { rules, cameraRules } = buildTexts(l.items)
          return {
            الموقع: l.location,
            "إجمالي القواعد": l.items.length,
            "قابلة للرصد بالكاميرا": l.items.filter((it) => it[1]).length,
            إدارية: l.items.filter((it) => !it[1]).length,
            "طول rules": rules.length,
            "طول cameraRules": cameraRules.length,
          }
        }),
      )
      return
    }

    await c.query("begin")

    await c.query(`alter table safety_rules add column if not exists camera_rules text not null default ''`)

    await c.query(`delete from safety_rules where "organizationId" = $1 and location = any($2::text[])`, [
      orgId,
      SEED_LOCATIONS,
    ])

    for (const l of LOCATIONS) {
      const { rules, cameraRules } = buildTexts(l.items)
      await c.query(
        `insert into safety_rules ("userId", "organizationId", location, rules, camera_rules, active, "createdAt", "updatedAt")
         values ($1, $2, $3, $4, $5, true, now(), now())`,
        [owner.id, orgId, l.location, rules, cameraRules],
      )
    }

    await c.query("commit")
    console.log(`017 done — seeded ${LOCATIONS.length} safety-rule location(s) for "${orgName}" [${orgId}], owner: ${owner.name}`)
  } catch (e) {
    if (!DRY) await c.query("rollback")
    throw e
  } finally {
    c.release()
    await pool.end()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
