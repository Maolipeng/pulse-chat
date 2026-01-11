"use client";

import { GearSix, X } from "@phosphor-icons/react";
import { getAvatarColor, getInitials } from "../utils/chat-utils";

export default function SettingsModal({
  open,
  user,
  notificationsEnabled,
  onClose,
  onNotifications,
  onResetEncryption,
  onSignOut,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 bg-emerald-950/30 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="h-12 w-12 rounded-full flex items-center justify-center text-sm font-semibold text-emerald-900"
              style={{ backgroundColor: getAvatarColor(user.username) }}
            >
              {getInitials(user.username)}
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-emerald-700">
                Settings
              </p>
              <h3 className="text-lg font-semibold text-emerald-950 mt-1">
                {user.username}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-full border border-emerald-100 text-emerald-800 bg-white transition active:scale-95 active:bg-emerald-50"
            aria-label="Close settings"
          >
            <X size={16} weight="regular" className="mx-auto" />
          </button>
        </div>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={onNotifications}
            className="w-full rounded-2xl border border-emerald-200 text-emerald-800 bg-white px-4 py-3 text-sm font-semibold transition active:scale-95 active:bg-emerald-100"
          >
            {notificationsEnabled ? "Notifications enabled" : "Enable notifications"}
          </button>
          <button
            type="button"
            onClick={onResetEncryption}
            className="w-full rounded-2xl border border-amber-200 text-amber-900 bg-amber-50 px-4 py-3 text-sm font-semibold transition active:scale-95 active:bg-amber-100"
          >
            Reset encryption state
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="w-full rounded-2xl border border-emerald-200 text-emerald-800 bg-white px-4 py-3 text-sm font-semibold transition active:scale-95 active:bg-emerald-100"
          >
            Sign out
          </button>
        </div>

        <div className="mt-5 flex items-center justify-center text-xs text-emerald-500">
          <GearSix size={14} weight="regular" className="mr-1" />
          Manage your chat preferences
        </div>
      </div>
    </div>
  );
}
