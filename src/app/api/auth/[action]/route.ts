import { cookies } from "next/headers";
import { accountRepository } from "@/lib/server/repository";
import { currentUser, sameOrigin, SESSION_COOKIE } from "@/lib/server/auth";
import { plans } from "@/lib/config";
export const runtime = "nodejs";
const validEmail = (v: unknown) =>
  typeof v === "string" &&
  v.length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const validPassword = (v: unknown) =>
  typeof v === "string" &&
  v.length >= 8 &&
  v.length <= 128 &&
  /[a-z]/.test(v) &&
  /[A-Z]/.test(v) &&
  /\d/.test(v);
const validName = (v: unknown) =>
  typeof v === "string" && v.trim().length > 0 && v.length <= 100;
export async function GET() {
  const user = await currentUser();
  return Response.json(
    { user },
    { status: user ? 200 : 401, headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ action: string }> },
) {
  if (!sameOrigin(request))
    return Response.json(
      { error: "Request origin is not allowed." },
      { status: 403 },
    );
  try {
    const { action } = await params;
    const body = await request.json();
    if (action === "logout") {
      const jar = await cookies();
      const token = jar.get(SESSION_COOKIE)?.value;
      if (token) accountRepository.logout(token);
      jar.delete(SESSION_COOKIE);
      return Response.json({ ok: true });
    }
    if (action === "forgot") {
      if (!validEmail(body.email))
        throw new Error("Enter a valid email address.");
      const token = accountRepository.resetToken(body.email);
      return Response.json({
        message: "Demo recovery is ready. No email is sent in this demo.",
        resetUrl: token ? `/reset-password?token=${token}` : null,
      });
    }
    if (action === "reset") {
      if (!validPassword(body.password))
        throw new Error(
          "Use 8–128 characters with uppercase, lowercase, and a number.",
        );
      if (typeof body.token !== "string")
        throw new Error("A reset token is required.");
      accountRepository.resetPassword(body.token, body.password);
      return Response.json({ ok: true });
    }
    if (action !== "login" && action !== "register")
      return Response.json(
        { error: "Unknown authentication action." },
        { status: 404 },
      );
    if (
      !validEmail(body.email) ||
      typeof body.password !== "string" ||
      body.password.length > 128
    )
      throw new Error("Enter a valid email address and password.");
    let user;
    if (action === "register") {
      if (
        !validName(body.firstName) ||
        !validName(body.lastName) ||
        !validName(body.company)
      )
        throw new Error(
          "First name, last name, and company are required (up to 100 characters).",
        );
      if (!validPassword(body.password))
        throw new Error(
          "Use 8–128 characters with uppercase, lowercase, and a number.",
        );
      if (body.password !== body.confirmPassword)
        throw new Error("Your passwords do not match.");
      if (!plans.includes(body.plan))
        throw new Error("Choose a valid access plan.");
      user = accountRepository.register({
        firstName: body.firstName.trim(),
        lastName: body.lastName.trim(),
        company: body.company.trim(),
        email: body.email,
        password: body.password,
        plan: body.plan,
      });
    } else {
      user = accountRepository.authenticate(body.email, body.password);
      if (!user)
        return Response.json(
          { error: "Email or password is incorrect. Please try again." },
          { status: 401 },
        );
    }
    const session = accountRepository.createSession(
      user.id,
      body.remember === true,
    );
    (await cookies()).set(SESSION_COOKIE, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: new URL(request.url).protocol === "https:",
      path: "/",
      ...(body.remember ? { maxAge: session.seconds } : {}),
    });
    return Response.json({ user });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to process this request.",
      },
      { status: 400 },
    );
  }
}
