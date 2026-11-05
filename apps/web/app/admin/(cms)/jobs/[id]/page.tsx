import { use } from 'react';
import { JobEditor } from '@/components/admin/editors';

export default function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <JobEditor id={id} />;
}
