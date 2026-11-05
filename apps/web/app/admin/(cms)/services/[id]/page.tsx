import { use } from 'react';
import { ServiceEditor } from '@/components/admin/editors';

export default function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <ServiceEditor id={id} />;
}
