import { currentUser } from "@/lib/server/auth";
import { forwardBotRequest } from "@/lib/server/bot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const user = await currentUser();
  return forwardBotRequest(request, (await context.params).path, user);
}

export { handle as GET, handle as POST, handle as DELETE };
