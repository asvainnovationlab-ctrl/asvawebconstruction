'use client';

/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  blogPostInputSchema,
  CONTENT_STATUSES,
  EMPLOYMENT_TYPES,
  JOB_STATUSES,
  jobInputSchema,
  LABELS,
  pageInputSchema,
  PERMISSIONS,
  projectInputSchema,
  serviceInputSchema,
  WORKPLACE_TYPES,
} from '@asva/shared';
import type { FieldDef } from './fields';
import { ResourceEditor, type EditorSection } from './resource';

const statusOptions = CONTENT_STATUSES.map((s) => ({ value: s, label: LABELS.contentStatus[s] }));

const publication: EditorSection = {
  title: 'Publishing',
  aside: true,
  description: 'Published items with a future date are scheduled automatically.',
  fields: [
    { type: 'select', name: 'status', label: 'Status', options: statusOptions },
    { type: 'datetime', name: 'publishedAt', label: 'Publication date', hint: 'Leave empty to publish immediately. A future date schedules publication.' },
  ],
};

const seo = (extra: FieldDef[] = []): EditorSection => ({
  title: 'SEO',
  aside: true,
  description: 'Falls back to the title and summary when empty.',
  fields: [{ type: 'text', name: 'seoTitle', label: 'SEO title', hint: 'Up to 70 characters' }, { type: 'textarea', name: 'seoDescription', label: 'Meta description', rows: 3, maxLength: 170 }, ...extra],
});

const nullable = (r: any, keys: string[]) => Object.fromEntries(keys.map((k) => [k, r[k] ?? null]));

export function PageEditor({ id }: { id: string }) {
  return (
    <ResourceEditor
      id={id}
      singular="Page"
      permission={PERMISSIONS.PAGES_MANAGE}
      endpoint="/admin/pages"
      listHref="/admin/pages"
      schema={pageInputSchema}
      defaults={{ title: '', slug: '', excerpt: '', content: '', featuredImageId: null, noIndex: false, seoTitle: '', seoDescription: '', status: 'DRAFT', publishedAt: null, revisionNote: '' }}
      toForm={(r) => ({ ...r, featuredImageId: r.featuredImage?.id ?? r.featuredImageId ?? null, ...nullable(r, ['excerpt', 'seoTitle', 'seoDescription']), revisionNote: '' })}
      previewHref={(r) => `/admin/preview/page/${r.id}`}
      publicHref={(r) => (r.status === 'PUBLISHED' ? `/${r.slug}` : null)}
      canDelete={(r) => !r.isSystem}
      deleteHint="Unpublish the page before deleting it. System pages cannot be deleted."
      revisions
      sections={[
        {
          title: 'Content',
          fields: [
            { type: 'text', name: 'title', label: 'Title', required: true, span: 2 },
            { type: 'slug', name: 'slug', label: 'URL slug', from: 'title', prefix: '/', span: 2 },
            { type: 'textarea', name: 'excerpt', label: 'Excerpt', rows: 2 },
            { type: 'rich', name: 'content', label: 'Body' },
            { type: 'text', name: 'revisionNote', label: 'Revision note', hint: 'Optional — describe what changed', span: 2 },
          ],
        },
        publication,
        { title: 'Featured image', aside: true, fields: [{ type: 'media', name: 'featuredImageId', label: 'Image' }] },
        seo([{ type: 'switch', name: 'noIndex', label: 'Hide from search engines', hint: 'Adds noindex and excludes the page from the sitemap' }]),
      ]}
    />
  );
}

export function ServiceEditor({ id }: { id: string }) {
  return (
    <ResourceEditor
      id={id}
      singular="Service"
      permission={PERMISSIONS.SERVICES_MANAGE}
      endpoint="/admin/services"
      listHref="/admin/services"
      schema={serviceInputSchema}
      defaults={{ name: '', slug: '', shortDescription: '', description: '', icon: 'Code2', coverImageId: null, features: [], technologyIds: [], displayOrder: 0, seoTitle: '', seoDescription: '', status: 'DRAFT', publishedAt: null }}
      toForm={(r) => ({ ...r, coverImageId: r.coverImage?.id ?? null, ...nullable(r, ['seoTitle', 'seoDescription']) })}
      previewHref={(r) => `/admin/preview/service/${r.id}`}
      publicHref={(r) => (r.status === 'PUBLISHED' ? `/services/${r.slug}` : null)}
      deleteHint="Unpublish the service before deleting it."
      sections={[
        {
          title: 'Service details',
          fields: [
            { type: 'text', name: 'name', label: 'Name', required: true },
            { type: 'slug', name: 'slug', label: 'URL slug', from: 'name', prefix: '/services/' },
            { type: 'textarea', name: 'shortDescription', label: 'Short description', required: true, rows: 2, maxLength: 300 },
            { type: 'rich', name: 'description', label: 'Full description' },
            { type: 'stringList', name: 'features', label: 'Features', hint: 'Shown as a checklist on the service page' },
            { type: 'multi', name: 'technologyIds', label: 'Technologies used', options: { endpoint: '/admin/technologies', labelKey: 'name' } },
          ],
        },
        publication,
        {
          title: 'Display',
          aside: true,
          fields: [
            { type: 'number', name: 'displayOrder', label: 'Display order', hint: 'Lower numbers appear first' },
            { type: 'media', name: 'coverImageId', label: 'Cover image' },
          ],
        },
        { title: 'Icon', aside: true, fields: [{ type: 'icon', name: 'icon', label: 'Icon' }] },
        seo(),
      ]}
    />
  );
}

export function ProjectEditor({ id }: { id: string }) {
  return (
    <ResourceEditor
      id={id}
      singular="Project"
      permission={PERMISSIONS.PROJECTS_MANAGE}
      endpoint="/admin/projects"
      listHref="/admin/projects"
      schema={projectInputSchema}
      defaults={{
        title: '', slug: '', summary: '', caseStudy: '', clientName: '', featuredImageId: null, gallery: [], categoryId: null, technologyIds: [], objectives: '', challenges: '', solution: '', results: '',
        projectUrl: '', completedAt: null, isFeatured: false, isSample: false, displayOrder: 0, seoTitle: '', seoDescription: '', status: 'DRAFT', publishedAt: null,
      }}
      toForm={(r) => ({
        ...r,
        featuredImageId: r.featuredImage?.id ?? null,
        categoryId: r.category?.id ?? null,
        gallery: r.galleryInput ?? [],
        ...nullable(r, ['clientName', 'objectives', 'challenges', 'solution', 'results', 'projectUrl', 'seoTitle', 'seoDescription']),
      })}
      previewHref={(r) => `/admin/preview/project/${r.id}`}
      publicHref={(r) => (r.status === 'PUBLISHED' ? `/portfolio/${r.slug}` : null)}
      deleteHint="Unpublish the project before deleting it."
      sections={[
        {
          title: 'Project',
          fields: [
            { type: 'text', name: 'title', label: 'Title', required: true },
            { type: 'slug', name: 'slug', label: 'URL slug', from: 'title', prefix: '/portfolio/' },
            { type: 'textarea', name: 'summary', label: 'Short summary', required: true, rows: 2, maxLength: 400 },
            { type: 'text', name: 'clientName', label: 'Client name', hint: 'Only with the client’s permission' },
            { type: 'url', name: 'projectUrl', label: 'Project URL' },
            { type: 'select', name: 'categoryId', label: 'Category', options: { endpoint: '/admin/project-categories', labelKey: 'name' }, allowEmpty: 'No category' },
            { type: 'date', name: 'completedAt', label: 'Completion date' },
            { type: 'multi', name: 'technologyIds', label: 'Technologies', options: { endpoint: '/admin/technologies', labelKey: 'name' } },
          ],
        },
        {
          title: 'Case study',
          description: 'Only include outcomes you can verify.',
          columns: 1,
          fields: [
            { type: 'textarea', name: 'objectives', label: 'Objectives', rows: 3 },
            { type: 'textarea', name: 'challenges', label: 'Challenges', rows: 3 },
            { type: 'textarea', name: 'solution', label: 'Solution', rows: 3 },
            { type: 'textarea', name: 'results', label: 'Results', rows: 3 },
            { type: 'rich', name: 'caseStudy', label: 'Detailed case study' },
          ],
        },
        { title: 'Gallery', columns: 1, fields: [{ type: 'gallery', name: 'gallery', label: 'Screenshots' }] },
        publication,
        {
          title: 'Display',
          aside: true,
          fields: [
            { type: 'switch', name: 'isFeatured', label: 'Feature on homepage' },
            { type: 'switch', name: 'isSample', label: 'Sample / demo content', hint: 'Shows a visible “Sample project” label' },
            { type: 'number', name: 'displayOrder', label: 'Display order' },
            { type: 'media', name: 'featuredImageId', label: 'Featured image' },
          ],
        },
        seo(),
      ]}
    />
  );
}

export function BlogPostEditor({ id }: { id: string }) {
  return (
    <ResourceEditor
      id={id}
      singular="Post"
      permission={PERMISSIONS.BLOG_MANAGE}
      endpoint="/admin/blog"
      listHref="/admin/blog"
      schema={blogPostInputSchema}
      defaults={{ title: '', slug: '', excerpt: '', content: '', featuredImageId: null, categoryId: null, authorId: null, tagIds: [], isFeatured: false, seoTitle: '', seoDescription: '', status: 'DRAFT', publishedAt: null, revisionNote: '' }}
      toForm={(r) => ({ ...r, featuredImageId: r.featuredImage?.id ?? null, categoryId: r.category?.id ?? null, authorId: r.author?.id ?? null, ...nullable(r, ['excerpt', 'seoTitle', 'seoDescription']), revisionNote: '' })}
      previewHref={(r) => `/admin/preview/blog/${r.id}`}
      publicHref={(r) => (r.status === 'PUBLISHED' ? `/blog/${r.slug}` : null)}
      deleteHint="Unpublish the post before deleting it."
      revisions
      sections={[
        {
          title: 'Article',
          fields: [
            { type: 'text', name: 'title', label: 'Title', required: true, span: 2 },
            { type: 'slug', name: 'slug', label: 'URL slug', from: 'title', prefix: '/blog/', span: 2 },
            { type: 'textarea', name: 'excerpt', label: 'Excerpt', rows: 2, maxLength: 500 },
            { type: 'rich', name: 'content', label: 'Content' },
            { type: 'text', name: 'revisionNote', label: 'Revision note', hint: 'Optional — describe what changed', span: 2 },
          ],
        },
        publication,
        {
          title: 'Organisation',
          aside: true,
          fields: [
            { type: 'select', name: 'authorId', label: 'Author', options: { endpoint: '/admin/authors', labelKey: 'name' }, allowEmpty: 'No author' },
            { type: 'select', name: 'categoryId', label: 'Category', options: { endpoint: '/admin/blog-categories', labelKey: 'name' }, allowEmpty: 'No category' },
            { type: 'multi', name: 'tagIds', label: 'Tags', options: { endpoint: '/admin/blog-tags', labelKey: 'name' } },
            { type: 'switch', name: 'isFeatured', label: 'Featured article' },
          ],
        },
        { title: 'Featured image', aside: true, fields: [{ type: 'media', name: 'featuredImageId', label: 'Image' }] },
        seo(),
      ]}
    />
  );
}

export function JobEditor({ id }: { id: string }) {
  return (
    <ResourceEditor
      id={id}
      singular="Job"
      permission={PERMISSIONS.JOBS_MANAGE}
      endpoint="/admin/jobs"
      listHref="/admin/jobs"
      schema={jobInputSchema}
      defaults={{ title: '', slug: '', department: '', location: 'Pokhara, Nepal', employmentType: 'FULL_TIME', workplaceType: 'ONSITE', summary: '', description: '', salaryRange: '', deadline: null, status: 'DRAFT', seoTitle: '', seoDescription: '' }}
      toForm={(r) => ({ ...r, ...nullable(r, ['salaryRange', 'seoTitle', 'seoDescription']) })}
      publicHref={(r) => (r.status === 'OPEN' ? `/careers/${r.slug}` : null)}
      canDelete={(r) => r._count?.applications === 0}
      deleteHint="Vacancies with applications cannot be deleted — archive them instead."
      sections={[
        {
          title: 'Vacancy',
          fields: [
            { type: 'text', name: 'title', label: 'Job title', required: true },
            { type: 'slug', name: 'slug', label: 'URL slug', from: 'title', prefix: '/careers/' },
            { type: 'text', name: 'department', label: 'Department', required: true },
            { type: 'text', name: 'location', label: 'Location', required: true },
            { type: 'select', name: 'employmentType', label: 'Employment type', options: EMPLOYMENT_TYPES.map((t) => ({ value: t, label: LABELS.employmentType[t] })) },
            { type: 'select', name: 'workplaceType', label: 'Workplace', options: WORKPLACE_TYPES.map((t) => ({ value: t, label: LABELS.workplaceType[t] })) },
            { type: 'text', name: 'salaryRange', label: 'Salary range', hint: 'Optional' },
            { type: 'date', name: 'deadline', label: 'Application deadline' },
            { type: 'textarea', name: 'summary', label: 'Summary', required: true, rows: 2 },
            { type: 'rich', name: 'description', label: 'Job description', hint: 'Responsibilities, requirements and benefits' },
          ],
        },
        {
          title: 'Status',
          aside: true,
          description: 'Open publishes the vacancy; Closed stops new applications; Archived hides it.',
          fields: [{ type: 'select', name: 'status', label: 'Status', options: JOB_STATUSES.map((s) => ({ value: s, label: LABELS.jobStatus[s] })) }],
        },
        seo(),
      ]}
    />
  );
}
