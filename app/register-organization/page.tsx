import { auth } from "@/lib/auth"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { RequestOrgForm } from "@/components/request-org-form"

export default async function RegisterOrganizationPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (session?.user) redirect("/")
  return <RequestOrgForm />
}
