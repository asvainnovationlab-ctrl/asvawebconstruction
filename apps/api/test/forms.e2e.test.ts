import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PrismaService } from '../src/prisma/prisma.service.js';
import { bootstrap, createUser, login } from './helpers.js';

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
const EXE = Buffer.from('4d5a90000300000004000000ffff0000', 'hex');

describe('Public forms, leads and careers', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    ({ app, prisma } = await bootstrap());
  });
  afterAll(async () => app.close());

  const inquiry = {
    fullName: 'Integration Visitor',
    email: 'visitor@example.com',
    phone: '+977 9800000000',
    companyName: 'Example Co',
    projectType: 'Web application',
    description: 'We need an online booking platform for our clinic in Pokhara.',
    budgetRange: 'NPR 5–15 lakh',
    timeline: '1–3 months',
    preferredContact: 'EMAIL',
    consent: true,
  };

  it('stores contact submissions, rejects duplicates and queues notifications', async () => {
    const body = { name: 'Contact Visitor', email: 'contact@example.com', message: 'Hello, I would like to talk about a project.', consent: true };
    await api().post('/api/v1/contact').send(body).expect(201);
    const stored = await prisma.contactSubmission.findFirstOrThrow({ where: { email: 'contact@example.com' } });
    expect(stored.isRead).toBe(false);
    expect(stored.ipHash).not.toContain('.'); // hashed, not a raw IP
    expect((await api().post('/api/v1/contact').send(body).expect(409)).body.error.code).toBe('DUPLICATE_SUBMISSION');
    // Confirmation email recorded (SKIPPED because SMTP is not configured — never reported as sent).
    const mail = await prisma.emailMessage.findFirstOrThrow({ where: { toAddress: 'contact@example.com' } });
    expect(mail.status).toBe('SKIPPED');
  });

  it('requires consent and silently drops honeypot submissions', async () => {
    await api().post('/api/v1/contact').send({ name: 'No Consent', email: 'nc@example.com', message: 'Hello there, testing consent.' }).expect(400);
    await api().post('/api/v1/contact').send({ name: 'Bot', email: 'bot@example.com', message: 'Buy now buy now buy now', consent: true, website: 'http://spam' }).expect(201);
    expect(await prisma.contactSubmission.count({ where: { email: 'bot@example.com' } })).toBe(0);
  });

  it('stores a project inquiry with an attachment and keeps it private', async () => {
    await api()
      .post('/api/v1/inquiries')
      .field('payload', JSON.stringify(inquiry))
      .attach('attachment', PDF, { filename: 'brief.pdf', contentType: 'application/pdf' })
      .expect(201);
    const lead = await prisma.projectInquiry.findFirstOrThrow({ where: { email: 'visitor@example.com' }, include: { attachment: true, activities: true } });
    expect(lead.status).toBe('NEW');
    expect(lead.attachment?.visibility).toBe('PRIVATE');
    expect(lead.activities.map((a) => a.type)).toContain('CREATED');
    // Private files are not reachable through the public media endpoint.
    await api().get(`/api/v1/media/files/${lead.attachmentId}`).expect(404);
  });

  it('rejects executables disguised as documents', async () => {
    const res = await api()
      .post('/api/v1/inquiries')
      .field('payload', JSON.stringify({ ...inquiry, email: 'exe@example.com' }))
      .attach('attachment', EXE, { filename: 'brief.pdf', contentType: 'application/pdf' })
      .expect(415);
    expect(res.body.error.code).toBe('FILE_CONTENT_MISMATCH');
    expect(await prisma.projectInquiry.count({ where: { email: 'exe@example.com' } })).toBe(0);
  });

  it('lets a sales manager work a lead through the pipeline with notes and audit history', async () => {
    const sales = await createUser(prisma, ['SALES_MANAGER']);
    const s = await login(app, sales.email);
    const lead = await prisma.projectInquiry.findFirstOrThrow({ where: { email: 'visitor@example.com' } });

    const invalid = await s.patch(`/api/v1/admin/inquiries/${lead.id}`).send({ status: 'WON' }).expect(400);
    expect(invalid.body.error.code).toBe('INVALID_TRANSITION');

    await s.patch(`/api/v1/admin/inquiries/${lead.id}`).send({ status: 'CONTACTED', assignedToId: sales.id }).expect(200);
    const withNote = await s.post(`/api/v1/admin/inquiries/${lead.id}/notes`).send({ body: 'Called the client; meeting on Friday.' }).expect(201);
    expect(withNote.body.data.notes[0].body).toContain('Friday');
    expect(withNote.body.data.activities.map((a: { type: string }) => a.type)).toEqual(expect.arrayContaining(['STATUS_CHANGED', 'ASSIGNED', 'NOTE_ADDED']));

    const csv = await s.agent.get('/api/v1/admin/inquiries/export').expect(200);
    expect(csv.headers['content-type']).toMatch(/text\/csv/);
    expect(csv.text).toContain('Integration Visitor');
    expect(await prisma.auditLog.count({ where: { action: 'inquiry.exported', actorId: sales.id } })).toBe(1);

    // Internal notes never appear on any public endpoint.
    const pub = await api().get('/api/v1/settings/public');
    expect(JSON.stringify(pub.body)).not.toContain('Friday');
  });

  it('accepts job applications with a resume and lets HR review them', async () => {
    const job = await prisma.job.create({
      data: { title: 'Test Engineer', slug: 'test-engineer', department: 'Engineering', location: 'Pokhara', employmentType: 'FULL_TIME', summary: 'Testing role', status: 'OPEN', publishedAt: new Date() },
    });
    const applicant = { fullName: 'Applicant One', email: 'applicant@example.com', phone: '+977 9811111111', consent: true };
    await api().post(`/api/v1/jobs/${job.id}/applications`).field('payload', JSON.stringify(applicant)).expect(400); // resume required
    await api().post(`/api/v1/jobs/${job.id}/applications`).field('payload', JSON.stringify(applicant)).attach('resume', PDF, { filename: 'cv.pdf', contentType: 'application/pdf' }).expect(201);

    const hr = await login(app, (await createUser(prisma, ['HR_MANAGER'])).email);
    const list = await hr.agent.get('/api/v1/admin/applications').expect(200);
    const app1 = list.body.data.find((a: { email: string }) => a.email === 'applicant@example.com');
    expect(app1).toBeTruthy();
    await hr.patch(`/api/v1/admin/applications/${app1.id}`).send({ status: 'UNDER_REVIEW', internalNotes: 'Strong portfolio', notifyApplicant: true }).expect(200);
    const resume = await hr.agent.get(`/api/v1/admin/applications/${app1.id}/resume`).expect(200);
    expect(resume.headers['content-disposition']).toMatch(/attachment/);
    expect(await prisma.auditLog.count({ where: { action: 'application.resume_downloaded' } })).toBe(1);
    expect(await prisma.emailMessage.count({ where: { toAddress: 'applicant@example.com', category: 'application.status' } })).toBe(1);

    // Closed vacancies stop accepting applications.
    await prisma.job.update({ where: { id: job.id }, data: { status: 'CLOSED' } });
    await api().get('/api/v1/jobs/test-engineer').expect(404);
  });

  it('runs a double opt-in newsletter flow without revealing existing subscribers', async () => {
    const first = await api().post('/api/v1/newsletter/subscribe').send({ email: 'reader@example.com', consent: true }).expect(200);
    const again = await api().post('/api/v1/newsletter/subscribe').send({ email: 'reader@example.com', consent: true }).expect(200);
    expect(first.body).toEqual(again.body);
    const sub = await prisma.newsletterSubscriber.findUniqueOrThrow({ where: { email: 'reader@example.com' } });
    expect(sub.status).toBe('PENDING');
    const mail = await prisma.emailMessage.findFirstOrThrow({ where: { toAddress: 'reader@example.com', category: 'newsletter.confirm' }, orderBy: { createdAt: 'desc' } });
    const token = decodeURIComponent(/token=([^"&<\s]+)/.exec(mail.text)![1]!);
    await api().post('/api/v1/newsletter/confirm').send({ token: `${token}x` }).expect(400);
    await api().post('/api/v1/newsletter/confirm').send({ token }).expect(200);
    expect((await prisma.newsletterSubscriber.findUniqueOrThrow({ where: { email: 'reader@example.com' } })).status).toBe('SUBSCRIBED');
  });
});
