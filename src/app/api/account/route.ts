import { authorize, sameOrigin } from "@/lib/server/auth";
import { accountRepository } from "@/lib/server/repository";
import { plans, type PublicUser } from "@/lib/config";
export async function PATCH(request: Request) {
  if (!sameOrigin(request))
    return Response.json(
      { error: "Request origin is not allowed." },
      { status: 403 },
    );
  const { user, error } = await authorize();
  if (error) return error;
  try {
    const body = await request.json();
    const changes: Partial<PublicUser> = {};
    if (body.plan !== undefined) {
      if (!plans.includes(body.plan)) throw new Error("Choose a valid plan.");
      changes.plan = body.plan;
    }
    for (const key of ["firstName", "lastName", "company"] as const)
      if (body[key] !== undefined) {
        if (
          typeof body[key] !== "string" ||
          !body[key].trim() ||
          body[key].length > 100
        )
          throw new Error(
            "Please complete every profile field (up to 100 characters).",
          );
        changes[key] = body[key].trim();
      }
    return Response.json({ user: accountRepository.update(user.id, changes) });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Unable to save changes." },
      { status: 400 },
    );
  }
}
