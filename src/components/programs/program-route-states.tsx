import { useRouter } from "@tanstack/react-router";
import type { ErrorRouteComponent } from "@tanstack/react-router";
import type { ComponentProps } from "react";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/cn";

function SkeletonBar({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export function PublicProgramViewPending() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-8" aria-busy="true">
      <div className="flex flex-col gap-3">
        <SkeletonBar className="h-4 w-16" />
        <SkeletonBar className="h-10 w-4/5 max-w-md" />
        <SkeletonBar className="h-4 w-2/5 max-w-xs" />
        <div className="mt-2 flex flex-wrap gap-2">
          <SkeletonBar className="h-7 w-24" />
          <SkeletonBar className="h-7 w-24" />
          <SkeletonBar className="h-7 w-28" />
        </div>
        <SkeletonBar className="mt-2 h-4 w-full" />
        <SkeletonBar className="h-4 w-[90%]" />
        <SkeletonBar className="mt-4 h-11 w-full rounded-lg" />
        <SkeletonBar className="h-11 w-full rounded-lg" />
        <SkeletonBar className="h-[4.5rem] w-full rounded-lg" />
        <SkeletonBar className="h-[4.5rem] w-full rounded-lg" />
      </div>
    </div>
  );
}

export function AuthorProfilePending() {
  return (
    <div className="px-4 py-8 lg:px-8" aria-busy="true">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <SkeletonBar className="size-[4.5rem] rounded-full" />
        <SkeletonBar className="h-10 w-1/2 max-w-xs" />
        <SkeletonBar className="h-4 w-[90%] max-w-lg" />
        <SkeletonBar className="mt-4 h-32 w-full rounded-xl" />
        <SkeletonBar className="h-32 w-full rounded-xl" />
      </div>
    </div>
  );
}

export function ProgramEditorPending() {
  return (
    <section className="px-4 pt-4 pb-8" aria-busy="true">
      <SkeletonBar className="mb-6 h-14 w-full max-w-md" />
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <SkeletonBar className="h-7 w-[4.5rem]" />
          <SkeletonBar className="h-7 w-[4.5rem]" />
          <SkeletonBar className="h-7 w-[4.5rem]" />
        </div>
        <SkeletonBar className="h-40 w-full rounded-xl" />
        <SkeletonBar className="h-20 w-full rounded-xl" />
      </div>
    </section>
  );
}

type ProgramRouteErrorKind = "program" | "profile" | "list";

const ERROR_HEADINGS: Record<ProgramRouteErrorKind, string> = {
  program: "This program didn't load",
  profile: "This profile didn't load",
  list: "Your programs didn't load",
};

function ProgramRouteErrorView({ kind }: { kind: ProgramRouteErrorKind }) {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-8">
      <h1 className="m-0 font-display text-3xl font-normal tracking-tight text-foreground sm:text-4xl">
        {ERROR_HEADINGS[kind]}
      </h1>
      <p className="mt-2 text-sm text-text-secondary">
        Check your connection and try again.
      </p>
      <Button
        type="button"
        size="touch"
        className="mt-6"
        onClick={() => void router.invalidate()}
      >
        Try again
      </Button>
    </div>
  );
}

export function createProgramRouteError(
  kind: ProgramRouteErrorKind,
): ErrorRouteComponent {
  return function ProgramRouteError() {
    return <ProgramRouteErrorView kind={kind} />;
  };
}

export const programRouteError = createProgramRouteError("program");
export const profileRouteError = createProgramRouteError("profile");
export const programListRouteError = createProgramRouteError("list");
