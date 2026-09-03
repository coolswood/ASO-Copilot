import { useState } from "react";
import { useNavigate } from "react-router";
import { Trash2 } from "lucide-react";

export default function DangerZone({ appId, name }: { appId: string; name: string }) {
  const navigate = useNavigate();
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    if (!confirm(`Stop tracking ${name}? This deletes all its keywords and history.`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/apps/${appId}`, { method: "DELETE" });
      // Navigating home remounts the dashboard, which fetches a fresh list —
      // covering the old router.refresh() after router.push("/").
      navigate("/");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="rounded-xl border border-red-500/30 bg-card p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="font-medium">Stop tracking this app</div>
          <p className="text-sm text-muted mt-1">
            {`Deletes ${name} and all of its keywords, competitors, and history. This can't be undone.`}
          </p>
        </div>
        <button
          onClick={remove}
          disabled={deleting}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10 hover:border-red-500/40 disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          {deleting ? "Removing..." : "Remove app"}
        </button>
      </div>
    </div>
  );
}
