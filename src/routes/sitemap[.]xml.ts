import { createFileRoute } from "@tanstack/react-router";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { useDb } from "#/db/client";
import * as schema from "#/db/schema";
import { buildSiteSitemapXml } from "#/lib/programs/sitemap-entries";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const rows = await useDb()
          .select({
            authorSlug: schema.user.slug,
            programSlug: schema.programs.slug,
            updatedAt: schema.programs.updatedAt,
          })
          .from(schema.programs)
          .innerJoin(schema.user, eq(schema.programs.userId, schema.user.id))
          .where(
            and(
              eq(schema.programs.visibility, "public"),
              isNull(schema.programs.deletedAt),
              isNull(schema.programs.hiddenAt),
              isNotNull(schema.programs.slug),
              isNotNull(schema.user.slug),
            ),
          );
        const programs = rows
          .filter(
            (
              row,
            ): row is typeof row & {
              authorSlug: string;
              programSlug: string;
            } => row.authorSlug != null && row.programSlug != null,
          )
          .map((row) => ({
            authorSlug: row.authorSlug,
            programSlug: row.programSlug,
            updatedAt: row.updatedAt.toISOString(),
          }));
        const body = buildSiteSitemapXml(programs);
        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
