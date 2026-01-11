"use client";

export default function IncomingCallModal({ offer, onAccept, onReject }) {
  if (!offer) return null;

  return (
    <div className="fixed inset-0 bg-emerald-950/30 flex items-center justify-center p-6">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl p-6 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-700">
          Incoming {offer.type || "audio"} call
        </p>
        <h3 className="text-2xl font-semibold text-emerald-950 mt-3">
          {offer.from}
        </h3>
        <p className="text-sm text-emerald-700 mt-2">Accept the call?</p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onReject}
            className="rounded-2xl border border-emerald-200 px-4 py-2 text-sm text-emerald-800"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="rounded-2xl bg-emerald-600 text-white px-4 py-2 text-sm"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
