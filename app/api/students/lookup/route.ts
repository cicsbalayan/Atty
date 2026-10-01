import { NextResponse } from "next/server"
import { lookupStudent } from "@/integration/students"
import { requireAdmin } from "@/lib/auth/dal"
import { parseJsonBody, requireString, respondWith } from "@/lib/api"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  return respondWith(async () => {
    await requireAdmin()
    const body = await parseJsonBody(request)
    const srcode = requireString(body, "srcode", 20)
    const student = await lookupStudent(srcode)
    return NextResponse.json({
      success: true,
      message: "Student found.",
      student,
    })
  })
}
