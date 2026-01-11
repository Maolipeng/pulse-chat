"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { resolveApiUrl } from "../utils/chat-utils";

export default function useAuth() {
  const apiUrl = resolveApiUrl();
  const [authMode, setAuthMode] = useState("login");
  const [authUsername, setAuthUsername] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [token, setToken] = useState("");
  const [authChecked, setAuthChecked] = useState(false);
  const [authOffline, setAuthOffline] = useState(false);
  const [user, setUser] = useState(null);
  const [needsValidation, setNeedsValidation] = useState(false);

  const apiFetch = useCallback(
    async (path, options = {}) => {
      const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${apiUrl}${path}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Request failed");
      }

      return response.json();
    },
    [apiUrl, token],
  );

  useEffect(() => {
    const stored = window.localStorage.getItem("pulsechat-token");
    const storedUser = window.localStorage.getItem("pulsechat-user");
    if (stored) {
      setToken(stored);
      if (storedUser) {
        try {
          const parsed = JSON.parse(storedUser);
          if (parsed?.username) {
            setUser(parsed);
            setAuthChecked(true);
            return;
          }
        } catch (error) {
          window.localStorage.removeItem("pulsechat-user");
        }
      }
      setNeedsValidation(true);
      return;
    }
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    if (!token || !needsValidation) return;

    const load = async () => {
      const maxRetries = 2;
      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
          const me = await apiFetch("/api/auth/me");
          setUser(me.user);
          window.localStorage.setItem("pulsechat-user", JSON.stringify(me.user));
          setAuthOffline(false);
          setNeedsValidation(false);
          setAuthChecked(true);
          return;
        } catch (error) {
          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, 600));
          } else {
            setUser((prev) => prev);
            setAuthOffline(true);
            setNeedsValidation(false);
            setAuthChecked(true);
          }
        }
      }
    };

    load();
  }, [apiFetch, needsValidation, token]);

  const handleAuth = useCallback(
    async (event) => {
      event.preventDefault();
      setAuthError("");

      try {
        const payload = await apiFetch(`/api/auth/${authMode}`, {
          method: "POST",
          body: JSON.stringify({
            username: authUsername.trim().toLowerCase(),
            password: authPassword,
          }),
        });
        setToken(payload.token);
        if (payload.user) {
          setUser(payload.user);
          window.localStorage.setItem("pulsechat-user", JSON.stringify(payload.user));
        }
        window.localStorage.setItem("pulsechat-token", payload.token);
        setAuthChecked(true);
        setAuthOffline(false);
      } catch (error) {
        setAuthError(error.message);
      }
    },
    [apiFetch, authMode, authUsername, authPassword],
  );

  const handleLogout = useCallback(() => {
    setToken("");
    setUser(null);
    window.localStorage.removeItem("pulsechat-token");
    window.localStorage.removeItem("pulsechat-user");
  }, []);

  return useMemo(
    () => ({
      apiFetch,
      authMode,
      authUsername,
      authPassword,
      authError,
      authChecked,
      authOffline,
      token,
      user,
      setAuthMode,
      setAuthUsername,
      setAuthPassword,
      handleAuth,
      handleLogout,
    }),
    [
      apiFetch,
      authMode,
      authUsername,
      authPassword,
      authError,
      authChecked,
      authOffline,
      token,
      user,
      handleAuth,
      handleLogout,
    ],
  );
}
