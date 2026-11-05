import { use } from 'react';
import { BlogPostEditor } from '@/components/admin/editors';

export default function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <BlogPostEditor id={id} />;
}
