import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth";

const BASE = `${import.meta.env.BASE_URL}api`.replace(/\/+$/, "");

export function ThemeSyncer() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const prevUserIdRef = useRef<number | null>(null);
  const isSyncingLoginRef = useRef(false);

  useEffect(() => {
    if (!user) {
      prevUserIdRef.current = null;
      return;
    }
    if (user.id === prevUserIdRef.current) return;
    prevUserIdRef.current = user.id;

    if (user.themePreference === "light" || user.themePreference === "dark") {
      isSyncingLoginRef.current = true;
      setTheme(user.themePreference);
    }
  }, [user, setTheme]);

  useEffect(() => {
    if (isSyncingLoginRef.current) {
      isSyncingLoginRef.current = false;
      return;
    }
    if (!user?.sessionToken || (theme !== "light" && theme !== "dark")) return;

    fetch(`${BASE}/users/me/theme`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${user.sessionToken}`,
      },
      body: JSON.stringify({ theme }),
    }).catch(() => {});
  }, [theme, user]);

  return null;
}
