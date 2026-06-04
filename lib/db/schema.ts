import { pgTable, text, timestamp, boolean, serial, integer, date } from "drizzle-orm/pg-core"

// ---------- Better Auth tables (do not rename columns) ----------
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  role: text("role").notNull().default("user"),
  status: text("status").notNull().default("pending"),
  // JSON string of per-section permissions: { [section]: { view, edit } }
  permissions: text("permissions").notNull().default(""),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

// ---------- HSE app tables (scoped by userId, no FK) ----------
export const company = pgTable("company", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  name: text("name").notNull().default(""),
  industry: text("industry").default(""),
  address: text("address").default(""),
  phone: text("phone").default(""),
  email: text("email").default(""),
  employeeCount: integer("employeeCount").default(0),
  hseManager: text("hseManager").default(""),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
})

export const incident = pgTable("incident", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  title: text("title").notNull(),
  location: text("location").default(""),
  type: text("type").default("near_miss"),
  severity: text("severity").default("low"),
  status: text("status").default("open"),
  reportedBy: text("reportedBy").default(""),
  description: text("description").default(""),
  incidentDate: date("incidentDate"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const inspection = pgTable("inspection", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  title: text("title").notNull(),
  area: text("area").default(""),
  inspector: text("inspector").default(""),
  status: text("status").default("scheduled"),
  compliance: integer("compliance").default(0),
  findings: integer("findings").default(0),
  inspectionDate: date("inspectionDate"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const permit = pgTable("permit", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  title: text("title").notNull(),
  type: text("type").default("hot_work"),
  location: text("location").default(""),
  requestedBy: text("requestedBy").default(""),
  status: text("status").default("pending"),
  validFrom: date("validFrom"),
  validTo: date("validTo"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const risk = pgTable("risk", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  hazard: text("hazard").notNull(),
  activity: text("activity").default(""),
  likelihood: integer("likelihood").default(1),
  consequence: integer("consequence").default(1),
  controls: text("controls").default(""),
  owner: text("owner").default(""),
  status: text("status").default("open"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const training = pgTable("training", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  title: text("title").notNull(),
  trainer: text("trainer").default(""),
  attendees: integer("attendees").default(0),
  status: text("status").default("scheduled"),
  trainingDate: date("trainingDate"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const ppe = pgTable("ppe", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  name: text("name").notNull(),
  category: text("category").default(""),
  inStock: integer("inStock").default(0),
  assigned: integer("assigned").default(0),
  minLevel: integer("minLevel").default(0),
  status: text("status").default("sufficient"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const correctiveAction = pgTable("corrective_action", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  title: text("title").notNull(),
  source: text("source").default(""),
  assignedTo: text("assignedTo").default(""),
  priority: text("priority").default("medium"),
  status: text("status").default("open"),
  dueDate: date("dueDate"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const audit = pgTable("audit", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  title: text("title").notNull(),
  standard: text("standard").default(""),
  auditor: text("auditor").default(""),
  score: integer("score").default(0),
  status: text("status").default("scheduled"),
  auditDate: date("auditDate"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const violation = pgTable("violation", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  documentNo: text("documentNo").default("MHS-IMS-PR-HSE-647"),
  companyName: text("companyName").default(""),
  employeeName: text("employeeName").notNull(),
  employeeNo: text("employeeNo").default(""),
  nationality: text("nationality").default(""),
  violationDate: date("violationDate"),
  violationTime: text("violationTime").default(""),
  place: text("place").default(""),
  description: text("description").default(""),
  witnesses: text("witnesses").default(""),
  evidences: text("evidences").default(""),
  proposedAction: text("proposedAction").default(""),
  status: text("status").default("open"),
  editorSignature: text("editor_signature").default(""),
  violatorSignature: text("violator_signature").default(""),
  managerSignature: text("manager_signature").default(""),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const attachment = pgTable("attachment", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  module: text("module").notNull(),
  recordId: integer("recordId").notNull(),
  kind: text("kind").notNull().default("photo"),
  pathname: text("pathname").notNull(),
  url: text("url").notNull().default(""),
  filename: text("filename").notNull().default(""),
  contentType: text("contentType").notNull().default(""),
  size: integer("size").notNull().default(0),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})

export const document = pgTable("document", {
  id: serial("id").primaryKey(),
  userId: text("userId").notNull(),
  title: text("title").notNull(),
  category: text("category").default(""),
  version: text("version").default("1.0"),
  owner: text("owner").default(""),
  status: text("status").default("active"),
  reviewDate: date("reviewDate"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
})
