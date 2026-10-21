import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export const PanelPlaceholder = ({ title }: { title: string }) => (
  <Card
    className="h-full min-h-0"
    aria-busy="true"
    aria-label={`Loading ${title}`}
  >
    <CardHeader>
      <CardTitle>{title}</CardTitle>
    </CardHeader>
    <CardContent className="space-y-4" aria-hidden="true">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
    </CardContent>
  </Card>
);
