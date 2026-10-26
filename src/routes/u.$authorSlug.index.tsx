import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { AuthorProfileSetup } from "#/components/programs/author-profile-setup";
import {
  AuthorProfilePending,
  profileRouteError,
} from "#/components/programs/program-route-states";
import { PublicAuthorProfile } from "#/components/programs/public-author-profile";
import { throwAuthorProfileHistoryRedirect } from "#/lib/programs/history-redirect";
import { loadPublicProgramOrNotFound } from "#/lib/programs/load-public-program";
import { SITE_URL, seoHead } from "#/lib/seo";
import {
  getPublicAuthorProfile,
  resolveAuthorProfileRoute,
} from "#/server/programs.fns";

export const Route = createFileRoute("/u/$authorSlug/")({
  loader: async ({ params }) => {
    const route = await resolveAuthorProfileRoute({
      data: { authorSlug: params.authorSlug },
    });
    if (route.kind === "not_found") {
      throw notFound();
    }
    if (route.kind === "redirect") {
      const currentSlug = route.path.replace(/^\/u\//, "");
      throwAuthorProfileHistoryRedirect(currentSlug);
    }
    const profile = await loadPublicProgramOrNotFound(() =>
      getPublicAuthorProfile({ data: { authorSlug: params.authorSlug } }),
    );
    return { profile };
  },
  pendingComponent: AuthorProfilePending,
  errorComponent: profileRouteError,
  head: ({ loaderData }) => {
    if (!loaderData?.profile || loaderData.profile.unavailable) {
      return {};
    }
    const { profile } = loaderData;
    const title = `${profile.displayName} · physlane`;
    const description =
      profile.bio?.trim() ||
      `Training programs by ${profile.displayName} on physlane.`;
    return seoHead({
      title,
      description,
      path: `/u/${profile.authorSlug}`,
      image: `${SITE_URL}/og.png`,
    });
  },
  component: AuthorProfilePage,
});

function AuthorProfilePage() {
  const { profile } = Route.useLoaderData();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);

  return (
    <>
      <PublicAuthorProfile
        profile={profile}
        onEditProfile={() => setEditOpen(true)}
      />
      {profile.isOwner ? (
        <AuthorProfileSetup
          open={editOpen}
          onOpenChange={setEditOpen}
          mode="edit"
          onSaved={async () => {
            await router.invalidate();
          }}
        />
      ) : null}
    </>
  );
}
