import { use } from 'react';
import { ProjectEditor } from '@/components/admin/editors';

export default function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ProjectEditor id={id} />;
}
