import {
  acceptAgentResult,
  pollAgent,
  validAgentToken,
} from "@/lib/server/local-data-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  if (!validAgentToken(request.headers.get("authorization")))
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  const reader = request.body?.getReader();
  if (!reader)
    return Response.json({ error: "Invalid request" }, { status: 400 });
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 8 * 1024 * 1024) {
      await reader.cancel();
      return Response.json(
        { error: "Response exceeds limit" },
        { status: 413 },
      );
    }
    chunks.push(value);
  }
  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    return Response.json({ error: "Invalid agent request" }, { status: 400 });
  if (
    body.action === "poll" &&
    typeof body.agentId === "string" &&
    /^[a-zA-Z0-9-]{1,80}$/.test(body.agentId) &&
    Number.isInteger(body.slots) &&
    body.slots >= 0 &&
    body.slots <= 3
  ) {
    return Response.json(
      { jobs: await pollAgent(body.agentId, body.slots, request.signal) },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (
    body.action === "result" &&
    uuid.test(body.id || "") &&
    uuid.test(body.lease || "") &&
    (body.failed === true || body.result !== undefined)
  ) {
    const accepted = await acceptAgentResult(
      body.id,
      body.lease,
      body.result,
      body.failed === true,
    );
    return Response.json({ accepted }, { status: accepted ? 200 : 409 });
  }
  return Response.json({ error: "Invalid agent operation" }, { status: 400 });
}
