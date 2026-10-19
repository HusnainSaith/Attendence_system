import { database } from "@/database/data-source";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(): Promise<Response> {
  try { await (await database()).query("SELECT 1"); return Response.json({ status: "ready" }); }
  catch { return Response.json({ status: "not_ready" }, { status: 503 }); }
}
