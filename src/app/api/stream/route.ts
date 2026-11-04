import { authorize } from "@/lib/server/auth";
import { accountRepository } from "@/lib/server/repository";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/server/auth";
import { readCollectionStatus } from "@/lib/server/energy-service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const { error } = await authorize("overview");
  if (error) return error;
  const token = (await cookies()).get(SESSION_COOKIE)!.value;
  const encoder = new TextEncoder();
  let interval: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream({
    start(controller) {
      let closed = false;
      let sending = false;
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(interval);
        try {
          controller.close();
        } catch {}
      };
      const send = async () => {
        if (closed || sending) return;
        sending = true;
        try {
          if (!(await accountRepository.getSession(token))) {
            close();
            return;
          }
          const result = await readCollectionStatus();
          controller.enqueue(
            encoder.encode(
              `event: collection\ndata: ${JSON.stringify(result)}\n\n`,
            ),
          );
        } catch {
          close();
        } finally {
          sending = false;
        }
      };
      interval = setInterval(() => void send(), 60_000);
      void send();
      if (request.signal.aborted) close();
      request.signal.addEventListener("abort", close, { once: true });
    },
    cancel() {
      clearInterval(interval);
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
