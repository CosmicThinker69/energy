import { cookies } from "next/headers";
import {
  accountRepository,
  DuplicateEmailError,
  InvalidResetTokenError,
} from "@/lib/server/repository";
import { currentUser, sameOrigin, SESSION_COOKIE } from "@/lib/server/auth";
import { mailService } from "@/lib/server/mail";
export const runtime = "nodejs";
class AuthInputError extends Error {}
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
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new AuthInputError("Enter valid request details.");
    }
    if (action === "logout") {
      const jar = await cookies();
      const token = jar.get(SESSION_COOKIE)?.value;
      if (token) await accountRepository.logout(token);
      jar.delete(SESSION_COOKIE);
      return Response.json({ ok: true });
    }
    if (action === "forgot") {
      if (!validEmail(body.email))
        throw new AuthInputError("Enter a valid email address.");
      const reset = await accountRepository.createResetToken(body.email);
      if (reset) {
        const resetUrl = new URL("/reset-password", request.url);
        resetUrl.searchParams.set("token", reset.token);
        await mailService
          .sendPasswordReset({
            email: reset.email,
            resetUrl: resetUrl.toString(),
          })
          .catch(() => false);
      }
      return Response.json({
        message:
          process.env.NODE_ENV === "development"
            ? "If an account exists, recovery instructions will be sent. Email delivery is not configured in this development environment."
            : "If an account exists, recovery instructions will be sent.",
      });
    }
    if (action === "reset") {
      if (!validPassword(body.password))
        throw new AuthInputError(
          "Use 8–128 characters with uppercase, lowercase, and a number.",
        );
      if (
        typeof body.token !== "string" ||
        !/^[A-Za-z0-9_-]{43}$/.test(body.token)
      )
        throw new AuthInputError("A reset token is required.");
      await accountRepository.resetPassword(body.token, body.password);
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
      throw new AuthInputError("Enter a valid email address and password.");
    let user;
    if (action === "register") {
      if (
        !validName(body.firstName) ||
        !validName(body.lastName) ||
        !validName(body.company)
      )
        throw new AuthInputError(
          "First name, last name, and company are required (up to 100 characters).",
        );
      if (!validPassword(body.password))
        throw new AuthInputError(
          "Use 8–128 characters with uppercase, lowercase, and a number.",
        );
      if (body.password !== body.confirmPassword)
        throw new AuthInputError("Your passwords do not match.");
      user = await accountRepository.register({
        firstName: body.firstName.trim(),
        lastName: body.lastName.trim(),
        company: body.company.trim(),
        email: body.email,
        password: body.password,
      });
    } else {
      user = await accountRepository.authenticate(body.email, body.password);
      if (!user)
        return Response.json(
          { error: "Email or password is incorrect. Please try again." },
          { status: 401 },
        );
    }
    const session = await accountRepository.createSession(
      user.id,
      body.remember === true,
    );
    (await cookies()).set(SESSION_COOKIE, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      ...(body.remember ? { maxAge: session.seconds } : {}),
    });
    return Response.json({ user });
  } catch (error) {
    const safe =
      error instanceof AuthInputError ||
      error instanceof DuplicateEmailError ||
      error instanceof InvalidResetTokenError ||
      error instanceof SyntaxError;
    return Response.json(
      {
        error: safe
          ? error.message
          : "Unable to process this request. Please try again.",
      },
      { status: safe ? 400 : 500 },
    );
  }
}
