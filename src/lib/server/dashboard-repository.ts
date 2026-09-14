import "server-only";
import { randomUUID } from "node:crypto";
import { db, query } from "./db";
import {
  isNativeDashboardKey,
  nativeDashboardKeys,
  viewerTypes,
  type DashboardInput,
  type DashboardRecord,
  type NativeDashboardKey,
  type ViewerType,
} from "../dashboard";
import { plans, type Plan } from "../config";

type DashboardRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  viewer_type: ViewerType;
  native_key: NativeDashboardKey | null;
  source_url: string | null;
  minimum_plan: Plan;
  badge: string | null;
  enabled: boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
};

const DASHBOARD_COLUMNS = `
  id, slug, title, description, category, viewer_type, native_key,
  source_url, minimum_plan, badge, enabled, sort_order, created_at, updated_at
`;

function dashboardRecord(row: DashboardRow): DashboardRecord {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    category: row.category,
    viewerType: row.viewer_type,
    nativeKey: row.native_key,
    sourceUrl: row.source_url,
    minimumPlan: row.minimum_plan,
    badge: row.badge,
    enabled: row.enabled,
    sortOrder: row.sort_order,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export class DashboardValidationError extends Error {}
export class DuplicateDashboardSlugError extends Error {}
export class DashboardNotFoundError extends Error {}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function externalUrl(value: unknown) {
  const source = text(value);
  if (!source || source.length > 2048) return null;
  try {
    const url = new URL(source);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function validateDashboardInput(value: unknown): DashboardInput {
  if (!value || typeof value !== "object") {
    throw new DashboardValidationError("Dashboard details are required.");
  }
  const input = value as Record<string, unknown>;
  const slug = text(input.slug);
  const title = text(input.title);
  const description = text(input.description);
  const category = text(input.category);
  const viewerType = text(input.viewerType);
  const minimumPlan = text(input.minimumPlan);
  const badge = text(input.badge) || null;
  const nativeKey = text(input.nativeKey) || null;
  const sourceUrl = externalUrl(input.sourceUrl);
  const sortOrder = Number(input.sortOrder);

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
    throw new DashboardValidationError(
      "Slug must use 2–80 lowercase letters, numbers, and single hyphens.",
    );
  }
  if (slug.length < 2) {
    throw new DashboardValidationError(
      "Slug must contain at least 2 characters.",
    );
  }
  if (!title || title.length > 120) {
    throw new DashboardValidationError("Title must contain 1–120 characters.");
  }
  if (description.length > 1000) {
    throw new DashboardValidationError(
      "Description must not exceed 1,000 characters.",
    );
  }
  if (!category || category.length > 80) {
    throw new DashboardValidationError(
      "Category must contain 1–80 characters.",
    );
  }
  if (!viewerTypes.includes(viewerType as ViewerType)) {
    throw new DashboardValidationError("Choose a supported dashboard type.");
  }
  if (!plans.includes(minimumPlan as Plan)) {
    throw new DashboardValidationError("Choose a supported minimum plan.");
  }
  if (badge && badge.length > 40) {
    throw new DashboardValidationError("Badge must not exceed 40 characters.");
  }
  if (!Number.isInteger(sortOrder) || Math.abs(sortOrder) > 100_000) {
    throw new DashboardValidationError("Sort order must be a whole number.");
  }
  if (viewerType === "native") {
    if (!isNativeDashboardKey(nativeKey)) {
      throw new DashboardValidationError(
        `Native key must be one of: ${nativeDashboardKeys.join(", ")}.`,
      );
    }
  } else if (!sourceUrl) {
    throw new DashboardValidationError(
      "Streamlit and External HTML dashboards require a valid HTTP or HTTPS URL without embedded credentials.",
    );
  }

  return {
    slug,
    title,
    description,
    category,
    viewerType: viewerType as ViewerType,
    nativeKey:
      viewerType === "native" ? (nativeKey as NativeDashboardKey) : null,
    sourceUrl: viewerType === "native" ? null : sourceUrl,
    minimumPlan: minimumPlan as Plan,
    badge,
    enabled: input.enabled === true,
    sortOrder,
  };
}

async function write<T>(operation: () => Promise<T>) {
  try {
    return await operation();
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new DuplicateDashboardSlugError(
        "A dashboard with this slug already exists.",
      );
    }
    throw error;
  }
}

export const dashboardRepository = {
  async getDashboards() {
    const result = await query<DashboardRow>(
      `SELECT ${DASHBOARD_COLUMNS}
       FROM portal.dashboards
       ORDER BY sort_order, title, id`,
    );
    return result.rows.map(dashboardRecord);
  },

  async getEnabledDashboards() {
    const result = await query<DashboardRow>(
      `SELECT ${DASHBOARD_COLUMNS}
       FROM portal.dashboards
       WHERE enabled = true
       ORDER BY sort_order, title, id`,
    );
    return result.rows.map(dashboardRecord);
  },

  async getDashboardBySlug(slug: string, includeDisabled = false) {
    const result = await query<DashboardRow>(
      `SELECT ${DASHBOARD_COLUMNS}
       FROM portal.dashboards
       WHERE slug = $1 AND ($2::boolean OR enabled = true)
       LIMIT 1`,
      [slug, includeDisabled],
    );
    return result.rows[0] ? dashboardRecord(result.rows[0]) : null;
  },

  async createDashboard(value: unknown, userId: string) {
    const input = validateDashboardInput(value);
    return write(async () => {
      const result = await query<DashboardRow>(
        `INSERT INTO portal.dashboards
          (id, slug, title, description, category, viewer_type, native_key,
           source_url, minimum_plan, badge, enabled, sort_order, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)
         RETURNING ${DASHBOARD_COLUMNS}`,
        [
          randomUUID(),
          input.slug,
          input.title,
          input.description,
          input.category,
          input.viewerType,
          input.nativeKey,
          input.sourceUrl,
          input.minimumPlan,
          input.badge,
          input.enabled,
          input.sortOrder,
          userId,
        ],
      );
      return dashboardRecord(result.rows[0]);
    });
  },

  async updateDashboard(id: string, value: unknown, userId: string) {
    if (!UUID_PATTERN.test(id)) {
      throw new DashboardValidationError("Dashboard identifier is invalid.");
    }
    const input = validateDashboardInput(value);
    return write(async () => {
      const result = await query<DashboardRow>(
        `UPDATE portal.dashboards
         SET slug = $2, title = $3, description = $4, category = $5,
             viewer_type = $6, native_key = $7, source_url = $8,
             minimum_plan = $9, badge = $10, enabled = $11,
             sort_order = $12, updated_by = $13, updated_at = now()
         WHERE id = $1
         RETURNING ${DASHBOARD_COLUMNS}`,
        [
          id,
          input.slug,
          input.title,
          input.description,
          input.category,
          input.viewerType,
          input.nativeKey,
          input.sourceUrl,
          input.minimumPlan,
          input.badge,
          input.enabled,
          input.sortOrder,
          userId,
        ],
      );
      if (!result.rows[0])
        throw new DashboardNotFoundError("Dashboard not found.");
      return dashboardRecord(result.rows[0]);
    });
  },

  async setDashboardEnabled(id: string, enabled: boolean, userId: string) {
    if (!UUID_PATTERN.test(id)) {
      throw new DashboardValidationError("Dashboard identifier is invalid.");
    }
    const result = await query<DashboardRow>(
      `UPDATE portal.dashboards
       SET enabled = $2, updated_by = $3, updated_at = now()
       WHERE id = $1
       RETURNING ${DASHBOARD_COLUMNS}`,
      [id, enabled, userId],
    );
    if (!result.rows[0])
      throw new DashboardNotFoundError("Dashboard not found.");
    return dashboardRecord(result.rows[0]);
  },

  async deleteDashboard(id: string) {
    if (!UUID_PATTERN.test(id)) {
      throw new DashboardValidationError("Dashboard identifier is invalid.");
    }
    const result = await query<{ id: string }>(
      "DELETE FROM portal.dashboards WHERE id = $1 RETURNING id",
      [id],
    );
    if (!result.rows[0])
      throw new DashboardNotFoundError("Dashboard not found.");
  },

  async reorderDashboards(ids: string[], userId: string) {
    if (
      !ids.length ||
      new Set(ids).size !== ids.length ||
      !ids.every((id) => UUID_PATTERN.test(id))
    ) {
      throw new DashboardValidationError("Provide a unique dashboard order.");
    }
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query<{ id: string }>(
        "SELECT id FROM portal.dashboards FOR UPDATE",
      );
      const requested = new Set(ids);
      if (
        existing.rowCount !== ids.length ||
        existing.rows.some((dashboard) => !requested.has(dashboard.id))
      ) {
        throw new DashboardValidationError(
          "Dashboard order contains an unknown record.",
        );
      }
      for (const [index, id] of ids.entries()) {
        await client.query(
          `UPDATE portal.dashboards
           SET sort_order = $2, updated_by = $3, updated_at = now()
           WHERE id = $1`,
          [id, index * 10, userId],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return this.getDashboards();
  },
};
