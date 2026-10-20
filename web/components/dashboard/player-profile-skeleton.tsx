import { Badge } from "@/components/ui/badge";
import {
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

export const PlayerProfileSkeleton = ({ name }: { name: string }) => (
  <DialogContent className="max-w-5xl">
    <header className="pr-8">
      <Badge variant="outline" className="border-primary/30 text-primary">
        Player profile
      </Badge>
      <DialogTitle className="mt-1 break-words text-2xl font-semibold">
        {name}
      </DialogTitle>
      <DialogDescription className="sr-only">
        Season player statistics and Elo history.
      </DialogDescription>
      <Skeleton aria-hidden="true" className="mt-1 h-5 w-48 max-w-full" />
    </header>
    <output className="sr-only">Loading profile…</output>
    <div aria-hidden="true" className="mt-3 space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            className="rounded-xl border border-border bg-card p-3"
          >
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-1 h-8 w-24" />
            <Skeleton className="mt-1 h-4 w-36 max-w-full" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card p-3">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="mt-2 h-48 max-h-[18dvh] w-full sm:h-56" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="min-w-0 rounded-xl border border-border bg-card p-3"
          >
            <Skeleton className="h-5 w-32 max-w-full" />
            <Skeleton className="mt-1 h-4 w-full" />
            <Skeleton className="mt-2 h-5 w-28" />
            <Skeleton className="mt-1 h-4 w-40 max-w-full" />
          </div>
        ))}
      </div>
    </div>
  </DialogContent>
);
