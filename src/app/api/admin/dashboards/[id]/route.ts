import { revalidatePath } from "next/cache";
import { authorizeAdmin, sameOrigin } from "@/lib/server/auth";
import {
  DashboardNotFoundError,
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
  if (error instanceof DashboardNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  console.error("Dashboard administration failed.", error);
  return Response.json(
    { error: "The dashboard change could not be saved." },
    { status: 500 },
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const { user, error } = await authorizeAdmin();
  if (error) return error;
  try {
    const { id } = await params;
    const body = await request.json();
    if (body.action === "enabled" && typeof body.enabled !== "boolean") {
      throw new DashboardValidationError("Enabled must be true or false.");
    }
    const dashboard =
      body.action === "enabled"
        ? await dashboardRepository.setDashboardEnabled(
            id,
            body.enabled === true,
            user!.id,
          )
        : await dashboardRepository.updateDashboard(id, body, user!.id);
    refreshDashboardRoutes();
    return Response.json({ dashboard });
  } catch (error) {
    return dashboardError(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  const { error } = await authorizeAdmin();
  if (error) return error;
  try {
    const { id } = await params;
    await dashboardRepository.deleteDashboard(id);
    refreshDashboardRoutes();
    return new Response(null, { status: 204 });
  } catch (error) {
    return dashboardError(error);
  }
}
