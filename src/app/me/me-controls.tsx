"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CodeReveal({ code }: { code: string }) {
  const [shown, setShown] = useState(false);
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        className="field rounded-lg px-4 py-2 font-mono text-2xl tracking-[0.15em]"
        onClick={() => setShown((v) => !v)}
      >
        {shown ? code : "••••••"}
      </button>
      <button
        type="button"
        className="field rounded-lg px-3 py-2 text-sm font-medium"
        onClick={async () => {
          await navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? "Copied ✓" : "Copy"}
      </button>
    </div>
  );
}

export function MySubmission(props: {
  id: string;
  questTitle: string;
  kind: string;
  bodyText: string | null;
  mediaUrl: string | null;
  isHidden: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <li className="card rounded-2xl p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">
            {props.questTitle}{" "}
            <span className="text-sm text-muted">· {props.kind}</span>
            {props.isHidden && (
              <span className="ml-2 text-sm text-danger">
                hidden by the hosts
              </span>
            )}
          </p>
          {props.bodyText && (
            <p className="mt-1 line-clamp-2 text-sm text-muted">
              “{props.bodyText}”
            </p>
          )}
        </div>
        <button
          type="button"
          disabled={busy}
          className="field shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-danger"
          onClick={async () => {
            if (!confirm("Delete this submission for good?")) return;
            setBusy(true);
            await fetch("/api/submissions/delete", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ submissionId: props.id }),
            });
            setBusy(false);
            router.refresh();
          }}
        >
          Delete
        </button>
      </div>
      {props.mediaUrl &&
        (props.kind === "video" ? (
          <video
            src={props.mediaUrl}
            controls
            playsInline
            preload="metadata"
            className="mt-2 max-h-60 w-full rounded-lg"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={props.mediaUrl}
            alt="Your submission"
            loading="lazy"
            className="mt-2 max-h-60 w-full rounded-lg object-contain"
          />
        ))}
    </li>
  );
}

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className="field w-full rounded-lg px-4 py-3 font-medium"
      onClick={async () => {
        await fetch("/api/logout", { method: "POST" });
        router.push("/login");
      }}
    >
      Log out
    </button>
  );
}
