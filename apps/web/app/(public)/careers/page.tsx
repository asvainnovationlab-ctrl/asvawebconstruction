import type { Metadata } from 'next';
import Link from 'next/link';
import { LABELS } from '@asva/shared';
import { ApplicationForm } from '@/components/forms/application-form';
import { PageHero, PhotoBanner, Section } from '@/components/site/blocks';
import { SITE_IMAGES } from '@/lib/site-images';
import { getJobs, getSettings } from '@/lib/api/public';
import { buildMetadata } from '@/lib/seo';
import { formatDate } from '@/lib/utils';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata(await getSettings(), {
    title: 'Careers',
    description: 'Join Asva Innovation Lab in Pokhara, Nepal. View open software engineering and design roles.',
    path: '/careers',
  });
}

export default async function CareersPage() {
  const [jobs, settings] = await Promise.all([getJobs(), getSettings()]);
  const { careers } = settings;
  return (
    <>
      <PageHero title="Careers" description={careers.intro} crumbs={[{ name: 'Careers', path: '/careers' }]} />
      <PhotoBanner src={SITE_IMAGES.teamReview.src} alt={SITE_IMAGES.teamReview.alt} />
      <Section>
        <div className="container-page">
          <h2 className="text-xl font-semibold">Open positions</h2>
          {jobs.length ? (
            <ul className="mt-6 divide-y border-y">
              {jobs.map((job) => (
                <li key={job.id}>
                  <Link href={`/careers/${job.slug}`} className="group grid gap-1 py-6 sm:grid-cols-12 sm:gap-6">
                    <div className="sm:col-span-6">
                      <h3 className="text-lg font-medium text-ink transition-colors group-hover:text-brand">{job.title}</h3>
                      <p className="mt-1 text-[15px] text-muted-ink">{job.summary}</p>
                    </div>
                    <p className="text-[14px] text-muted-ink sm:col-span-4">
                      {[job.department, job.location, LABELS.employmentType[job.employmentType], LABELS.workplaceType[job.workplaceType]].join(' · ')}
                    </p>
                    <p className="text-[14px] text-muted-ink sm:col-span-2 sm:text-right">{job.deadline ? `Apply by ${formatDate(job.deadline)}` : 'Open'}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-6 border-y py-10">
              <p className="font-medium text-ink">No open vacancies right now</p>
              <p className="mt-1 max-w-xl text-[15px] text-muted-ink">{careers.noVacanciesMessage}</p>
            </div>
          )}

          {careers.acceptGeneralApplications && (
            <section aria-labelledby="general-application" className="mt-20 grid gap-10 lg:grid-cols-12">
              <div className="lg:col-span-4">
                <h2 id="general-application" className="type-section">
                  General application
                </h2>
                <p className="mt-4 text-[15px] leading-relaxed text-muted-ink">Don’t see the right role? Send us your CV and we will contact you when a suitable position opens.</p>
              </div>
              <div className="lg:col-span-7 lg:col-start-6">
                <ApplicationForm jobId={null} jobTitle="General application" />
              </div>
            </section>
          )}
        </div>
      </Section>
    </>
  );
}
