import { logoutAction } from "@/app/(auth)/actions";

export default function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button type="submit" className="text-slate-500 hover:text-slate-800">
        Log out
      </button>
    </form>
  );
}
