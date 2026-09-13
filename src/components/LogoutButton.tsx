import { logoutAction } from "@/app/(auth)/actions";

export default function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button type="submit" className="hover:text-white">
        Log out
      </button>
    </form>
  );
}
