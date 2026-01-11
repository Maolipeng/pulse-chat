"use client";

export default function ComposerModal({
  open,
  mode,
  onClose,
  userSearch,
  onUserSearch,
  userResults,
  onQuickChat,
  composerTitle,
  onComposerTitle,
  composerMembers,
  onComposerMembers,
  onCreateGroup,
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-emerald-950/40 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-emerald-950">
            {mode === "chat" ? "Start a chat" : "Create a group"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-emerald-700"
          >
            Close
          </button>
        </div>

        {mode === "chat" ? (
          <div className="mt-4">
            <label className="text-sm font-medium text-emerald-900">
              Search users
            </label>
            <input
              value={userSearch}
              onChange={(event) => onUserSearch(event.target.value)}
              placeholder="Type a username"
              className="mt-2 w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-base outline-none focus:border-emerald-500"
            />
            <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
              {userResults.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  onClick={() => onQuickChat(result.username)}
                  className="w-full text-left rounded-2xl border border-emerald-100 px-4 py-3 text-sm text-emerald-900 hover:border-emerald-300"
                >
                  {result.username}
                </button>
              ))}
              {userSearch && userResults.length === 0 && (
                <div className="text-sm text-emerald-600">
                  No users found.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-emerald-900">
                Group name
              </label>
              <input
                value={composerTitle}
                onChange={(event) => onComposerTitle(event.target.value)}
                placeholder="e.g. Weekend Team"
                className="mt-2 w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-base outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-emerald-900">
                Members (comma separated usernames)
              </label>
              <input
                value={composerMembers}
                onChange={(event) => onComposerMembers(event.target.value)}
                placeholder="mia, alex, tom"
                className="mt-2 w-full rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-base outline-none focus:border-emerald-500"
              />
            </div>
            <button
              type="button"
              onClick={onCreateGroup}
              className="w-full rounded-2xl bg-emerald-600 text-white py-3 font-semibold"
            >
              Create group
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
