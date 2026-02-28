'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../ui/button';

export function BackButton() {
  const router = useRouter();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-mutedForeground hover:text-foreground"
      onClick={() => router.back()}
    >
      <ArrowLeft className="mr-1 h-4 w-4" />
      Back
    </Button>
  );
}
