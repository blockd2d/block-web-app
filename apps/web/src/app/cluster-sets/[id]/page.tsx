import { redirect } from 'next/navigation';

export default function ClusterSetDetailRedirect({ params }: { params: { id: string } }) {
  redirect(`/app/territories/${params.id}`);
}
