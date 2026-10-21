import {
  chatGPTSignInPath,
  chatGPTSignOutPath,
  getChatGPTUser,
} from "@/app/chatgpt-auth";
import { Dashboard } from "@/components/dashboard";
import { getAdmin } from "@/lib/admin";
import { isOwner } from "@/lib/admin-access";
import { getDashboardData } from "@/lib/store";
import { Suspense } from "react";
import DashboardLoading from "@/components/dashboard/dashboard-loading";

export const dynamic = "force-dynamic";

const DashboardPage = async ({
  searchParams,
}: {
  searchParams: Promise<{ seasonId?: string }>;
}) => {
  const [data, user, admin] = await Promise.all([
    getDashboardData(),
    getChatGPTUser(),
    getAdmin(),
  ]);
  const requested = (await searchParams).seasonId;
  const selectedSeason =
    requested === undefined
      ? null
      : data.seasons.find(({ id }) => String(id) === requested);
  if (selectedSeason === undefined) {
    return (
      <main className="p-6">
        <h1 className="text-2xl">Season unavailable</h1>
        <a href="/" className="mt-4 inline-block text-primary">
          View current leaderboard
        </a>
      </main>
    );
  }
  return (
    <Dashboard
      initialSeasonId={selectedSeason?.id ?? null}
      data={data}
      userEmail={user?.email ?? null}
      isAdmin={Boolean(admin)}
      canPreviewThemes={Boolean(user && isOwner(user.email))}
      signInHref={chatGPTSignInPath("/admin")}
      signOutHref={chatGPTSignOutPath("/")}
    />
  );
};

const Home = (props: { searchParams: Promise<{ seasonId?: string }> }) => (
  <Suspense fallback={<DashboardLoading />}>
    <DashboardPage {...props} />
  </Suspense>
);

export default Home;
