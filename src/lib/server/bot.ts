import "server-only";
import { canAccess, type PublicUser } from "../config";
import { sameOrigin } from "./origin";

const UPLOAD_LIMIT = 20 * 1024 * 1024;
const JSON_LIMIT = 64 * 1024;

function error(message: string, status: number) {
  return Response.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

class BodyTooLarge extends Error {}

async function limitedBody(request: Request, limit: number) {
  const declared = Number(request.headers.get("content-length"));
  if (declared > limit) throw new BodyTooLarge();
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new BodyTooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

/** Fixed routes only. Never forward browser cookies, credentials or arbitrary URLs. */
export async function forwardBotRequest(
  request: Request,
  path: string[],
  user: PublicUser | null,
) {
  if (!user) return error("Your session has ended. Please sign in.", 401);
  const mutation = request.method !== "GET";
  if (mutation && !sameOrigin(request))
    return error("Invalid request origin.", 403);

  const name = path[0];
  const allowed =
    (path.length === 1 &&
      request.method === "GET" &&
      ["status", "documents"].includes(name)) ||
    (path.length === 1 &&
      request.method === "POST" &&
      ["ask", "upload"].includes(name)) ||
    (path.length === 2 && name === "documents" && request.method === "DELETE");
  if (!allowed) return error("Assistant endpoint not found.", 404);
  const manageDocuments = name === "upload" || request.method === "DELETE";
  if (
    manageDocuments ? user.role !== "admin" : !canAccess(user.plan, "assistant")
  ) {
    return error(
      manageDocuments
        ? "Administrator access is required."
        : "Ask TEMO requires Premium access.",
      403,
    );
  }
  if (
    path.length === 2 &&
    (!path[1] ||
      /[\\/\x00-\x1f]/.test(path[1]) ||
      [".", ".."].includes(path[1]))
  ) {
    return error("Choose a valid document.", 400);
  }

  const base = process.env.BOT_SERVICE_URL;
  const token = process.env.BOT_SERVICE_TOKEN;
  const setupError = (detail: string) =>
    error(
      user.role === "admin"
        ? detail
        : "The research assistant is not connected yet. Please try again later.",
      503,
    );
  if (!base)
    return setupError(
      "BOT_SERVICE_URL is missing on the main app. Add it to the energy service variables and redeploy energy.",
    );
  if (!token)
    return setupError(
      "BOT_SERVICE_TOKEN is missing on the main app. Copy the token from energy-bot to the energy service variables and redeploy energy.",
    );
  if (token === "YOUR_EXISTING_BOT_SERVICE_TOKEN")
    return setupError(
      "BOT_SERVICE_TOKEN still contains the example placeholder. Replace it with the actual token from energy-bot and redeploy energy.",
    );
  if (token.length < 32)
    return setupError(
      "BOT_SERVICE_TOKEN on the main app is shorter than 32 characters. Use the same token of at least 32 characters on energy and energy-bot, then redeploy both.",
    );
  let url: URL;
  try {
    url = new URL(base);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      throw new Error("Invalid service URL");
    }
    url.pathname = "/api/" + path.map(encodeURIComponent).join("/");
  } catch {
    return setupError(
      "BOT_SERVICE_URL on the main app is invalid. Use http://energy-bot.railway.internal:8080 without an /api suffix, then redeploy energy.",
    );
  }

  try {
    let body: Uint8Array<ArrayBuffer> | string | undefined;
    const headers: Record<string, string> = { "X-TEMO-Service-Token": token };
    if (name === "ask") {
      if (
        !request.headers
          .get("content-type")
          ?.toLowerCase()
          .startsWith("application/json")
      ) {
        return error("Send your question as JSON.", 400);
      }
      let input;
      try {
        input = JSON.parse(
          new TextDecoder().decode(await limitedBody(request, JSON_LIMIT)),
        );
      } catch (cause) {
        if (cause instanceof BodyTooLarge) throw cause;
        return error("Provide a valid question.", 400);
      }
      if (
        typeof input?.question !== "string" ||
        !input.question.trim() ||
        input.question.length > 8000
      ) {
        return error("Enter a question of up to 8,000 characters.", 400);
      }
      // Preserve the bot's automatic routing. No history, source filters or extra context.
      body = JSON.stringify({ question: input.question.trim() });
      headers["Content-Type"] = "application/json";
    } else if (name === "upload") {
      const contentType = request.headers.get("content-type") || "";
      if (!/^multipart\/form-data;.*boundary=/i.test(contentType)) {
        return error("Choose PDF, Excel or CSV files to upload.", 400);
      }
      body = await limitedBody(request, UPLOAD_LIMIT);
      headers["Content-Type"] = contentType;
    }
    const response = await fetch(url, {
      method: request.method,
      headers,
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.any([
        request.signal,
        AbortSignal.timeout(
          name === "upload" ? 600_000 : name === "ask" ? 300_000 : 30_000,
        ),
      ]),
    });
    if (!response.ok) {
      // The original bot includes internal error details. Keep these server-side.
      await response.body?.cancel();
      if (response.status === 401 && user.role === "admin")
        return error(
          "The bot rejected BOT_SERVICE_TOKEN. Set the exact same token on energy and energy-bot, then redeploy both services.",
          503,
        );
      if (response.status === 400 || response.status === 422)
        return error(
          "The assistant could not process that request. Check your question or document format.",
          400,
        );
      return error(
        "The research assistant is unavailable. Please try again shortly.",
        503,
      );
    }
    const data = await response.json();
    if (name === "status") {
      // Do not expose model hosts or raw backend errors to the browser.
      return Response.json(
        {
          llm_ok: data.llm_ok === true,
          chunks: data.chunks,
          tables: data.tables,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    return Response.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    if (cause instanceof BodyTooLarge)
      return error(
        name === "upload"
          ? "Keep each upload below 20 MB in total."
          : "Your question is too large.",
        413,
      );
    return error(
      "The research assistant did not respond. Please try again shortly.",
      503,
    );
  }
}
