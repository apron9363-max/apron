import { Suspense } from "react";
import HistoryListClient from "./_components/HistoryListClient";
import { listHistoryPaginatedAction } from "@/server/actions/userActions";
import type { HistoryPageRow } from "@/server/actions/userActions";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  let rows: HistoryPageRow[] = [];
  let nextCursor: { id: string; kind: "earning" | "withdrawal" } | null = null;
  let hasMore = false;
  try {
    const res = await listHistoryPaginatedAction({ kind: "all", source: "all", limit: 50 });
    if (res && res.ok) {
      rows = res.rows;
      nextCursor = res.nextCursor;
      hasMore = res.hasMore;
    }
  } catch {
    rows = [];
    nextCursor = null;
    hasMore = false;
  }

  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-12 text-sm text-white/60">
        Loading history…
      </div>
    }>
      <HistoryListClient
        initialRows={rows}
        initialNextCursor={nextCursor}
        initialHasMore={hasMore}
      />
    </Suspense>
  );
}
