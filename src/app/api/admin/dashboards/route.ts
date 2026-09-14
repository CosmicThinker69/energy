import { revalidatePath } from "next/cache";
import { authorizeAdmin, sameOrigin } from "@/lib/server/auth";
import {
  DashboardValidationError,
  DuplicateDashboardSlugError,
  dashboardRepository,
} from "@/lib/server/dashboard-repository";

function refreshDashboardRoutes() {
  revalidatePath("/", "layout");
  revalidatePath("/dashboards");
}

function dashboardError(error: unknown) {
  if (error instanceof SyntaxError) {
    return Response.json(
      { error: "Provide valid JSON dashboard details." },
      { status: 400 },
    );
  }
  if (error instanceof DashboardValidationError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof DuplicateDashboardSlugError) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  console.error("Dashboard administration failed.", error);
  return Response.json(
    { error: "The dashboard change could not be saved." },
    { status: 500 },
  );
}

export async function GET() {
  const { error } = await authorizeAdmin();
  if (error) return error;
  return Response.json({
    dashboards: await dashboardRepository.getDashboards(),
  });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const { user, error } = await authorizeAdmin();
  if (error) return error;
  try {
    const body = await request.json();
    if (body.action === "reorder") {
      const ids = Array.isArray(body.ids)
        ? body.ids.filter((id: unknown): id is string => typeof id === "string")
        : [];
      const dashboards = await dashboardRepository.reorderDashboards(
        ids,
        user!.id,
      );
      refreshDashboardRoutes();
      return Response.json({ dashboards });
    }
    const dashboard = await dashboardRepository.createDashboard(body, user!.id);
    refreshDashboardRoutes();
    return Response.json({ dashboard }, { status: 201 });
  } catch (error) {
    return dashboardError(error);
  }
}
