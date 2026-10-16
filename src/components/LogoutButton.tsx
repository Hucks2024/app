import { logoutAction } from "@/app/(auth)/actions";
import { getT } from "@/i18n/server";

export default async function LogoutButton({ className = "nav-link" }: { className?: string }) {
  const t = await getT();
  return (
    <form action={logoutAction}>
      <button type="submit" className={className}>
        {t.common.signOut}
      </button>
    </form>
  );
}
