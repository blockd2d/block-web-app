"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

export default function AcceptInviteClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token"); // or whatever param you use

  // render UI + call your accept endpoint, etc.
  return <div>Token: {token ?? "missing"}</div>;
}
