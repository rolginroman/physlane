import {
  createFileRoute,
  notFound,
  Outlet,
  useMatches,
  useRouter,
} from "@tanstack/react-router";
import { useState } from "react";
import { AuthorProfileSetup } from "#/components/programs/author-profile-setup";
import { PublicAuthorProfile } from "#/components/programs/public-author-profile";
import { isAuthorProfileLeafPath } from "#/lib/programs/author-profile-route";
import { throwAuthorProfileHistoryRedirect } from "#/lib/programs/history-redirect";
import { loadPublicProgramOrNotFound } from "#/lib/programs/load-public-program";
import { SITE_URL, seoHead } from "#/lib/seo";
import {
  getPublicAuthorProfile,
  resolveAuthorProfileRoute,
} from "#/server/programs.fns";

export const Route = createFileRoute("/u/$authorSlug")({
  staticData: { appChrome: false },
  loader: async ({ params, location }) => {
    if (!isAuthorProfileLeafPath(location.pathname, params.authorSlug)) {
      return { profile: null };
    }
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
  const isProfileLeaf = useMatches({
    select: (matches) => matches.at(-1)?.routeId === Route.id,
  });
  const { profile } = Route.useLoaderData();
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);

  if (!isProfileLeaf) {
    return <Outlet />;
  }

  if (!profile) {
    return null;
  }

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
