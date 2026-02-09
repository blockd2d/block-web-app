import * as React from "react";
import { Suspense } from "react";
import AcceptInviteClient from "./accept-invite-client";

export default function Page() {
  return (
    <Suspense fallback={<div>Loading invite…</div>}>
      <AcceptInviteClient />
    </Suspense>
  );
}
