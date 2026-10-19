import {
  chatGPTSignInPath,
  chatGPTSignOutPath,
  getChatGPTUser,
} from "@/app/chatgpt-auth";
import { Dashboard } from "@/components/dashboard";
import { getAdmin } from "@/lib/admin";
import { isOwner } from "@/lib/admin-access";
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
      canPreviewThemes={Boolean(user && isOwner(user.email))}
      signInHref={chatGPTSignInPath("/admin")}
      signOutHref={chatGPTSignOutPath("/")}
    />
  );
};

export default Home;
