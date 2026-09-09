import { cookies } from "next/headers";
import { accountRepository } from "./repository";
import { canAccess, type DashboardId } from "../config";
export const SESSION_COOKIE = "temo-session";
export async function currentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? accountRepository.getSession(token) : null;
}
export async function authorize(
  resource?: DashboardId | "explorer" | "reports" | "overview",
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
