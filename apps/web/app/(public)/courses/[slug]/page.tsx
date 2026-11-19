import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CourseEnrollmentForm } from '@/components/forms/course-enrollment-form';
import { PageHero, Section } from '@/components/site/blocks';
import { COURSES } from '@/lib/courses';
import { getSettings } from '@/lib/api/public';
import { buildMetadata } from '@/lib/seo';

type Props = { params: Promise<{ slug: string }> };

function findCourse(slug: string) {
  return COURSES.find((course) => course.slug === slug);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const course = findCourse(slug);
  if (!course) return { title: 'Course not found' };
  return buildMetadata(await getSettings(), {
    title: course.title,
    description: course.description,
    path: `/courses/${course.slug}`,
  });
}

export default async function CoursePage({ params }: Props) {
  const { slug } = await params;
  const course = findCourse(slug);
  if (!course) notFound();

  return (
    <>
      <PageHero
        eyebrow={`${course.brand.name} course`}
        title={course.title}
        description={course.description}
        crumbs={[{ name: 'Courses', path: '/courses' }, { name: course.title, path: `/courses/${course.slug}` }]}
      />
      <Section>
        <div className="container-page grid items-start gap-12 lg:grid-cols-12">
          <article className="lg:col-span-7">
            <div className="relative grid aspect-[16/9] place-items-center overflow-hidden rounded-lg border bg-surface">
              <svg aria-hidden viewBox="0 0 24 24" className="size-2/3" fill={`#${course.brand.icon.hex}`}>
                <path d={course.brand.icon.path} />
              </svg>
              <span className="absolute bottom-5 left-5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-ink shadow-sm">
                {course.brand.name}
              </span>
            </div>
            <div className="mt-8">
              <h2 className="text-xl font-semibold text-ink">Course overview</h2>
              <p className="mt-3 text-[16px] leading-relaxed text-muted-ink">{course.description}</p>
            </div>
            <div className="mt-8">
              <h2 className="text-xl font-semibold text-ink">Topics covered</h2>
              <ul className="mt-4 space-y-3">
                {course.syllabus.map((topic) => (
                  <li key={topic} className="flex items-start gap-3 text-[15px] leading-relaxed text-muted-ink">
                    <span aria-hidden className="mt-2 size-2 shrink-0 rounded-full bg-brand" />
                    {topic}
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-8">
              <h2 className="text-xl font-semibold text-ink">Tools and technologies</h2>
              <ul className="mt-4 flex flex-wrap gap-2">
                {course.technologies.map((technology) => (
                  <li key={technology} className="rounded-full bg-surface px-3 py-1.5 text-sm font-medium text-brand">
                    {technology}
                  </li>
                ))}
              </ul>
            </div>
          </article>
          <aside className="rounded-2xl border border-slate-200 p-6 shadow-sm sm:p-8 lg:sticky lg:top-24 lg:col-span-5">
            <h2 className="text-xl font-semibold text-ink">Enquire or enroll</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-ink">
              Send us your details and our team will follow up about enrollment, schedule, fees, and any questions.
            </p>
            <div className="mt-6">
              <CourseEnrollmentForm courseTitle={course.title} />
            </div>
          </aside>
        </div>
      </Section>
    </>
  );
}
