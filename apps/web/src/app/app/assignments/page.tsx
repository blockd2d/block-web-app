"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { api } from "../../../lib/api";
import { useMe } from "../../../lib/use-me";

type ClusterSet = { id: string; name: string; status: string };

export default function AssignmentsPage() {
  const router = useRouter();
  const { me } = useMe();
  const [clusterSets, setClusterSets] = React.useState<ClusterSet[]>([]);

  React.useEffect(() => {
    api.get("/v1/auth/me").catch(() => router.replace("/login"));
  }, [router]);

  React.useEffect(() => {
    api
      .get("/v1/cluster-sets")
      .then((r: any) => setClusterSets((r.items || []).filter((x: any) => x.status === "complete")))
      .catch(() => {});
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Assignments</h1>
      <p className="mt-1 text-sm text-mutedForeground">
        Assign clusters to reps per territory set. Open a set to bulk-assign, auto-suggest, or export.
      </p>

      <div className="mt-6 rounded-2xl border border-border bg-card shadow-soft">
        <div className="border-b border-border px-4 py-3 text-sm font-semibold">Territory sets</div>
        <div className="divide-y divide-border">
          {clusterSets.length ? (
            clusterSets.map((cs) => (
              <div key={cs.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="font-medium">{cs.name}</div>
                  <div className="text-xs text-mutedForeground">{cs.status}</div>
                </div>
                <Link
                  href={`/app/territories/${cs.id}`}
                  className="shrink-0 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  Assign clusters
                </Link>
              </div>
            ))
          ) : (
            <div className="px-4 py-6 text-sm text-mutedForeground">
              No complete territory sets yet. Create one in{" "}
              <Link href="/app/territories" className="text-primary hover:underline">
                Territories
              </Link>
              .
            </div>
          )}
        </div>
      </div>

      <div className="mt-4">
        <Link className="text-sm text-primary underline underline-offset-4 hover:opacity-90" href="/app/territories">
          Create or manage territory sets
        </Link>
      </div>
    </div>
  );
}
