import { redirect } from "next/navigation";

const Page = async ({
  searchParams,
}: {
  searchParams: Promise<{ seasonId?: string }>;
}) => {
  const { seasonId } = await searchParams;
  redirect(
    seasonId === undefined ? "/" : `/?seasonId=${encodeURIComponent(seasonId)}`,
  );
};

export default Page;
