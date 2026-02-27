import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen grid place-items-center p-6 bg-background text-foreground">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="text-sm text-mutedForeground">The page you’re looking for doesn’t exist or was moved.</p>
        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primaryForeground hover:opacity-90"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
