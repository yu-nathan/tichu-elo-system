import { AdminPanel } from "@/components/admin-panel";
import { getChatGPTUser, chatGPTSignInPath } from "@/app/chatgpt-auth";
import { env } from "cloudflare:workers";
import { hasAdminAccess, isOwner, listAdmins } from "@/lib/admin-access";
import { getAppData } from "@/lib/store";

export const dynamic = "force-dynamic";

const AdminPage = async () => {
  const user = await getChatGPTUser();

  if (!user) {
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <div className="max-w-md rounded-2xl border border-white/10 bg-card p-8 text-center">
          <h1 className="text-2xl font-semibold">Admin sign in</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Sign in with the ChatGPT account authorized to manage this
            leaderboard.
          </p>
          <a
            href={chatGPTSignInPath("/admin")}
            target="_top"
            className="mt-6 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Sign in with ChatGPT
          </a>
        </div>
      </main>
    );
  }

  if (!(await hasAdminAccess(user.email, env.DB))) {
    return (
      <main className="grid min-h-screen place-items-center px-4">
        <div className="max-w-md rounded-2xl border border-red-400/20 bg-card p-8">
          <h1 className="text-2xl font-semibold">Access denied</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            This account is signed in, but it is not authorized to edit the
            Tichu leaderboard.
          </p>
          <a className="mt-5 inline-block text-sm text-emerald-300" href="/">
            Return to leaderboard
          </a>
        </div>
      </main>
    );
  }

  return (
    <AdminPanel
      initialData={await getAppData()}
      initialAdmins={isOwner(user.email) ? await listAdmins(env.DB) : null}
    />
  );
};

export default AdminPage;
