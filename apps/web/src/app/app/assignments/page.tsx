"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { api } from "../../../lib/api";
import { AppShell } from "../../../ui/shell";

export default function AssignmentsPage() {
  const router = useRouter();
  const [me, setMe] = useState<any>(null);

  useEffect(() => {
    api
      .get("/v1/auth/me")
      .then((r: any) => setMe(r.user))
      .catch(() => router.replace("/login"));
  }, [router]);

  return (
    <AppShell active="assignments" me={me}>
      <div className="p-6">
        <h1 className="text-2xl font-semibold">Assignments</h1>
        <p className="mt-1 text-sm text-mutedForeground">
          Assignments are managed per territory set. Open a territory set to bulk-assign clusters, or export assignments.
        </p>
        <div className="mt-4">
          <Link className="text-sm text-primary underline underline-offset-4 hover:opacity-90" href="/app/territories">
            Go to territories
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
