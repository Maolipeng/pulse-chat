"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useAuth from "../hooks/useAuth";
import AuthPage from "../components/AuthPage";

export default function LoginPage() {
  const router = useRouter();
  const {
    authMode,
    authUsername,
    authPassword,
    authError,
    authOffline,
    authChecked,
    token,
    user,
    setAuthMode,
    setAuthUsername,
    setAuthPassword,
    handleAuth,
  } = useAuth();

  useEffect(() => {
    if (authChecked && token && user) {
      router.replace("/chats");
    }
  }, [authChecked, router, token, user]);

  return (
    <AuthPage
      authMode={authMode}
      authUsername={authUsername}
      authPassword={authPassword}
      authError={authError}
      authOffline={authOffline}
      authChecked={authChecked}
      onAuthMode={setAuthMode}
      onAuthUsername={setAuthUsername}
      onAuthPassword={setAuthPassword}
      onSubmit={handleAuth}
    />
  );
}
