import type { Metadata } from 'next';
import Link from 'next/link';
import { BackdropImage, PageHero, Section } from '@/components/site/blocks';
import { Button } from '@/components/ui/button';
import { SITE_IMAGES } from '@/lib/site-images';
import { COURSES } from '@/lib/courses';
import { getSettings } from '@/lib/api/public';
import { buildMetadata } from '@/lib/seo';

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata(await getSettings(), {
    title: 'Courses',
    description: 'Explore practical technology courses in web and mobile development, UI/UX, data and AI, cloud and DevOps, and cybersecurity.',
    path: '/courses',
  });
}

export default async function CoursesPage() {
  return (
    <>
      <PageHero
        eyebrow="Learn with Asva"
        title="Build practical skills for a career in tech"
        description="Explore technology courses across in-demand IT fields, guided by a team that builds digital products every day. Get in touch to ask about available courses and enrollment."
        crumbs={[{ name: 'Courses', path: '/courses' }]}
      />

      <Section labelledBy="courses-title">
        <div className="container-page">
          <div className="max-w-2xl">
            <h2 id="courses-title" className="type-section text-ink">
              Explore our courses
            </h2>
            <p className="mt-4 text-base leading-relaxed text-muted-ink sm:text-[17px]">
              Choose a direction that interests you. Contact us for details about the curriculum, schedule and the next available courses.
            </p>
          </div>
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {COURSES.map((course) => (
              <li key={course.slug}>
                <Link
                  href={`/courses/${course.slug}`}
                  aria-label={`View ${course.title} course details`}
                  className="course-card relative block aspect-[4/5] overflow-hidden rounded-lg border border-line bg-dark shadow-sm outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                >
                  <div className="absolute inset-0 bg-surface">
                    <svg
                      aria-hidden
                      viewBox="0 0 24 24"
                      className="absolute left-1/2 top-1/2 h-3/4 w-3/4 -translate-x-1/2 -translate-y-1/2"
                      fill={`#${course.brand.icon.hex}`}
                    >
                      <path d={course.brand.icon.path} />
                    </svg>
                    <div className="absolute inset-0 bg-gradient-to-t from-dark/25 via-transparent to-transparent" />
                  </div>
                  <div className="course-card-cover absolute inset-0 flex flex-col items-start justify-between p-5">
                    <div className="rounded-lg bg-white px-3 py-2 shadow-md">
                      <span className="text-[13px] font-semibold text-ink">{course.brand.name}</span>
                    </div>
                    <h3 className="max-w-sm text-[22px] font-semibold leading-tight text-white drop-shadow-md">{course.title}</h3>
                  </div>
                  <div className="course-card-details absolute inset-0 flex flex-col justify-end overflow-y-auto p-5 text-white">
                    <div className="mb-auto self-start rounded-lg bg-white px-3 py-2 shadow-md">
                      <span className="text-[13px] font-semibold text-ink">{course.brand.name}</span>
                    </div>
                    <h3 className="text-xl font-semibold leading-tight">{course.title}</h3>
                    <ul className="flex flex-wrap gap-2" aria-label={`${course.title} technologies`}>
                      {course.technologies.map((technology) => (
                        <li key={technology} className="rounded-full bg-white/15 px-2.5 py-1 text-[12px] font-medium text-white">
                          {technology}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 text-[14px] leading-relaxed text-white/90">{course.description}</p>
                    <h4 className="mt-5 text-[12px] font-semibold uppercase tracking-[0.08em] text-white">What you will learn</h4>
                    <ul className="mt-3 space-y-2">
                      {course.syllabus.map((item) => (
                        <li key={item} className="flex gap-2 text-[13px] leading-relaxed text-white/90">
                          <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section tone="dark" className="relative overflow-hidden">
        <BackdropImage src={SITE_IMAGES.teamCollab.src} />
        <div className="container-page relative grid items-end gap-6 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <h2 className="type-section text-white">Ready to learn something new?</h2>
            <p className="mt-4 max-w-xl text-[17px] text-mist">Contact us to find out more about our courses and how to get started.</p>
          </div>
          <div className="lg:col-span-4 lg:justify-self-end">
            <Button asChild size="lg">
              <Link href="/contact">Ask about courses</Link>
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
