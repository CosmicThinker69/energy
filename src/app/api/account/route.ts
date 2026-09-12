import { authorize, sameOrigin } from "@/lib/server/auth";
import { accountRepository } from "@/lib/server/repository";
class ProfileInputError extends Error {}
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
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new ProfileInputError("Enter valid profile details.");
    }
    if (body.plan !== undefined) {
      return Response.json(
        { error: "Your plan cannot be changed from account settings." },
        { status: 403 },
      );
    }
    const changes = { firstName: "", lastName: "", company: "" };
    for (const key of ["firstName", "lastName", "company"] as const)
      if (
        typeof body[key] !== "string" ||
        !body[key].trim() ||
        body[key].length > 100
      )
        throw new ProfileInputError(
          "Please complete every profile field (up to 100 characters).",
        );
      else changes[key] = body[key].trim();
    return Response.json({
      user: await accountRepository.updateProfile(user.id, changes),
    });
  } catch (e) {
    const safe = e instanceof ProfileInputError || e instanceof SyntaxError;
    return Response.json(
      {
        error: safe ? e.message : "Unable to save changes. Please try again.",
      },
      { status: safe ? 400 : 500 },
    );
  }
}
