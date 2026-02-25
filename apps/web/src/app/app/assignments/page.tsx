"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { api } from "../../../lib/api";
import { useMe } from "../../../lib/use-me";

export default function AssignmentsPage() {
  const router = useRouter();
  const { me } = useMe();

  useEffect(() => {
    // If backend access is revoked mid-session, allow page-level redirect.
    api.get("/v1/auth/me").catch(() => router.replace("/login"));
  }, [router]);

  return (
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
    </div>
  );
}
