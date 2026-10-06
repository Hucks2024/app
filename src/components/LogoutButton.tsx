import { logoutAction } from "@/app/(auth)/actions";

export default function LogoutButton({ className = "nav-link" }: { className?: string }) {
  return (
    <form action={logoutAction}>
      <button type="submit" className={className}>
        Sign out
      </button>
    </form>
  );
}
