"use client";

export default function AuthPage({
  authMode,
  authUsername,
  authPassword,
  authError,
  authOffline,
  authChecked,
  onAuthMode,
  onAuthUsername,
  onAuthPassword,
  onSubmit,
}) {
  if (!authChecked) {
    return (
      <div className="min-h-[var(--app-height,100svh)] flex items-center justify-center px-4 py-6 sm:p-6">
        <div className="w-full max-w-md bg-white/85 border border-white/60 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-700">
            PulseChat
          </p>
          <p className="mt-4 text-sm text-emerald-800">
            Checking your session...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-6 sm:p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md bg-white/85 border border-white/60 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur"
      >
        <p className="text-sm uppercase tracking-[0.3em] text-emerald-700">
          PulseChat
        </p>
        <h1 className="text-3xl md:text-4xl font-semibold mt-3 text-emerald-950">
          {authMode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="text-sm text-emerald-800 mt-3">
          {authMode === "login"
            ? "Sign in to continue your conversations."
            : "Pick a username and password to get started."}
        </p>

        {authOffline && (
          <div className="mt-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            Server unreachable. You can retry login or wait for reconnection.
          </div>
        )}

        {authError && (
          <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
            {authError}
          </div>
        )}

        <div className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-medium text-emerald-900">
              Username
            </label>
            <input
              value={authUsername}
              onChange={(event) => onAuthUsername(event.target.value)}
              placeholder="e.g. mia"
              className="mt-2 w-full rounded-2xl border border-emerald-200 bg-white/90 px-4 py-3 text-base outline-none focus:border-emerald-500"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-emerald-900">
              Password
            </label>
            <input
              type="password"
              value={authPassword}
              onChange={(event) => onAuthPassword(event.target.value)}
              placeholder="••••••••"
              className="mt-2 w-full rounded-2xl border border-emerald-200 bg-white/90 px-4 py-3 text-base outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        <button
          type="submit"
          className="mt-6 w-full rounded-2xl bg-emerald-600 text-white py-3 font-semibold hover:bg-emerald-700 transition"
        >
          {authMode === "login" ? "Sign in" : "Create account"}
        </button>

        <button
          type="button"
          onClick={() => onAuthMode(authMode === "login" ? "register" : "login")}
          className="mt-4 w-full text-sm text-emerald-700"
        >
          {authMode === "login"
            ? "Need an account? Register"
            : "Have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
