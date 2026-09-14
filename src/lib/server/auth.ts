import { cookies } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { accountRepository } from "./repository";
import { canAccess, canAccessPlan, type Plan } from "../config";
export const SESSION_COOKIE = "temo-session";
export async function currentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? accountRepository.getSession(token) : null;
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect("/login");
  return user;
}
export async function requireAccess(
  resource: "explorer" | "reports" | "overview",
) {
  const user = await requireUser();
  return canAccess(user.plan, resource) ? user : null;
}
export async function authorize(
  resource?: "explorer" | "reports" | "overview",
) {
  const user = await currentUser();
  if (!user)
    return {
      user: null,
      error: Response.json(
        { error: "Your session has ended. Please sign in." },
        { status: 401 },
      ),
    };
  if (resource && !canAccess(user.plan, resource))
    return {
      user: null,
      error: Response.json(
        { error: "Your current plan does not include this dashboard." },
        { status: 403 },
      ),
    };
  return { user, error: null };
}
export async function requireDashboardPlan(minimumPlan: Plan) {
  const user = await requireUser();
  return canAccessPlan(user.plan, minimumPlan) ? user : null;
}
export async function authorizeDashboardPlan(minimumPlan: Plan) {
  const user = await currentUser();
  if (!user)
    return {
      user: null,
      error: Response.json(
        { error: "Your session has ended. Please sign in." },
        { status: 401 },
      ),
    };
  if (!canAccessPlan(user.plan, minimumPlan))
    return {
      user: null,
      error: Response.json(
        { error: "Your current plan does not include this dashboard." },
        { status: 403 },
      ),
    };
  return { user, error: null };
}
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") forbidden();
  return user;
}
export async function authorizeAdmin() {
  const user = await currentUser();
  if (!user)
    return {
      user: null,
      error: Response.json(
        { error: "Your session has ended. Please sign in." },
        { status: 401 },
      ),
    };
  if (user.role !== "admin")
    return {
      user: null,
      error: Response.json(
        { error: "Administrator access is required." },
        { status: 403 },
      ),
    };
  return { user, error: null };
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return (
      new URL(origin).host ===
      (request.headers.get("host") || new URL(request.url).host)
    );
  } catch {
    return false;
  }
}
