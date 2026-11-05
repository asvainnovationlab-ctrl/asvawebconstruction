import type { Metadata } from 'next';
import { LABELS } from '@asva/shared';
import { ApplicationForm } from '@/components/forms/application-form';
import { JsonLd, PageHero, RichText, Section } from '@/components/site/blocks';
import { getJob, getSettings } from '@/lib/api/public';
import { notFoundOrRedirect } from '@/lib/not-found';
import { buildMetadata } from '@/lib/seo';
import { absoluteUrl, formatDate } from '@/lib/utils';

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const [settings, job] = await Promise.all([getSettings(), getJob(slug)]);
  if (!job) return { title: 'Vacancy not found' };
  return buildMetadata(settings, { title: job.seoTitle ?? `${job.title} — Careers`, description: job.seoDescription ?? job.summary, path: `/careers/${job.slug}` });
}

export default async function JobPage({ params }: Props) {
  const { slug } = await params;
  const [job, settings] = await Promise.all([getJob(slug), getSettings()]);
  if (!job) return notFoundOrRedirect(`/careers/${slug}`);

  const employmentType = { FULL_TIME: 'FULL_TIME', PART_TIME: 'PART_TIME', CONTRACT: 'CONTRACTOR', INTERNSHIP: 'INTERN', TEMPORARY: 'TEMPORARY' }[job.employmentType];
  return (
    <>
      {/* JobPosting structured data only uses fields that are actually set. */}
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'JobPosting',
          title: job.title,
          description: job.description || job.summary,
          datePosted: job.publishedAt,
          ...(job.deadline ? { validThrough: job.deadline } : {}),
          employmentType,
          hiringOrganization: { '@type': 'Organization', name: settings.general.companyName, sameAs: absoluteUrl('/') },
          jobLocation: { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: job.location, addressCountry: 'NP' } },
          ...(job.workplaceType === 'REMOTE' ? { jobLocationType: 'TELECOMMUTE' } : {}),
          directApply: true,
        }}
      />
      <PageHero eyebrow={job.department} title={job.title} description={job.summary} crumbs={[{ name: 'Careers', path: '/careers' }, { name: job.title, path: `/careers/${job.slug}` }]} />
      <Section tone="white">
        <div className="container-page grid gap-12 lg:grid-cols-12">
          <article className="lg:col-span-7">
            <dl className="mb-10 grid grid-cols-2 gap-4 rounded-2xl border border-slate-200 bg-surface p-6 text-sm sm:grid-cols-4">
              <Item label="Type" value={LABELS.employmentType[job.employmentType]} />
              <Item label="Workplace" value={LABELS.workplaceType[job.workplaceType]} />
              <Item label="Location" value={job.location} />
              <Item label="Apply by" value={job.deadline ? formatDate(job.deadline) : 'Open until filled'} />
              {job.salaryRange && <Item label="Salary" value={job.salaryRange} />}
            </dl>
            <RichText html={job.description} />
          </article>
          <aside className="lg:col-span-5">
            <div className="rounded-2xl border border-slate-200 p-6 shadow-sm sm:p-8 lg:sticky lg:top-24">
              <h2 className="text-xl font-semibold text-ink">Apply for this role</h2>
              <div className="mt-6">
                <ApplicationForm jobId={job.id} jobTitle={job.title} />
              </div>
            </div>
          </aside>
        </div>
      </Section>
    </>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-ink">{label}</dt>
      <dd className="mt-1 font-medium text-ink">{value}</dd>
    </div>
  );
}
