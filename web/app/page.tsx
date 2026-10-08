import {
  chatGPTSignInPath,
  chatGPTSignOutPath,
  getChatGPTUser,
} from "@/app/chatgpt-auth";
import { Dashboard } from "@/components/dashboard";
import { getAdmin } from "@/lib/admin";
import { getDashboardData } from "@/lib/store";

export const dynamic = "force-dynamic";

const Home = async () => {
  const [data, user, admin] = await Promise.all([
    getDashboardData(),
    getChatGPTUser(),
    getAdmin(),
  ]);
  return (
    <Dashboard
      data={data}
      userEmail={user?.email ?? null}
      isAdmin={Boolean(admin)}
      signInHref={chatGPTSignInPath("/admin")}
      signOutHref={chatGPTSignOutPath("/")}
    />
  );
};

export default Home;
