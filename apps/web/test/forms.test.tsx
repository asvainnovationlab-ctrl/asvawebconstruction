import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ContactForm } from '@/components/forms/contact-form';
import { InquiryForm } from '@/components/forms/inquiry-form';

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => handler(String(input), init));
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('ContactForm', () => {
  it('shows accessible validation messages and does not submit invalid data', async () => {
    const fetchSpy = mockFetch(() => json({}));
    render(<ContactForm />);
    await userEvent.click(screen.getByRole('button', { name: /send message/i }));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText(/accept the privacy policy/i)).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('submits valid data, shows the success state and sends spam-protection fields', async () => {
    const fetchSpy = mockFetch((url) => (url.includes('/auth/csrf') ? json({ data: {} }) : json({ data: { received: true, message: 'Thank you! Your message has been received.' } }, 201)));
    render(<ContactForm />);
    await userEvent.type(screen.getByLabelText(/full name/i), 'Test Visitor');
    await userEvent.type(screen.getByLabelText(/^email/i), 'visitor@example.com');
    await userEvent.type(screen.getByLabelText(/^message/i), 'I would like to discuss a project.');
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: /send message/i }));
    expect(await screen.findByText('Message sent')).toBeInTheDocument();
    const call = fetchSpy.mock.calls.find(([u]) => String(u).endsWith('/api/v1/contact'))!;
    const body = JSON.parse(String(call[1]!.body));
    expect(body).toMatchObject({ name: 'Test Visitor', email: 'visitor@example.com', consent: true, website: '' });
    expect(typeof body.formStartedAt).toBe('number');
  });

  it('maps server-side field errors back onto the form', async () => {
    mockFetch((url) =>
      url.includes('/auth/csrf')
        ? json({ data: {} })
        : json({ error: { code: 'VALIDATION_ERROR', message: 'Please correct the highlighted fields.', details: [{ path: 'email', message: 'This address is blocked' }] } }, 400),
    );
    render(<ContactForm />);
    await userEvent.type(screen.getByLabelText(/full name/i), 'Test Visitor');
    await userEvent.type(screen.getByLabelText(/^email/i), 'visitor@example.com');
    await userEvent.type(screen.getByLabelText(/^message/i), 'I would like to discuss a project.');
    await userEvent.click(screen.getByRole('checkbox'));
    await userEvent.click(screen.getByRole('button', { name: /send message/i }));
    expect(await screen.findByText('This address is blocked')).toBeInTheDocument();
  });
});

describe('InquiryForm', () => {
  it('validates each step before moving on and allows going back', async () => {
    render(<InquiryForm />);
    expect(screen.getByRole('heading', { name: 'About you' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(await screen.findByText('Full name is required')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/full name/i), 'Test Visitor');
    await userEvent.type(screen.getByLabelText(/business email/i), 'visitor@example.com');
    await userEvent.type(screen.getByLabelText(/phone number/i), '+977 9800000000');
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Your project' })).toBeInTheDocument());

    await userEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByRole('heading', { name: 'About you' })).toBeInTheDocument();
    expect(screen.getByLabelText(/full name/i)).toHaveValue('Test Visitor');
  });

  it('rejects attachments with unsupported types before upload', async () => {
    render(<InquiryForm />);
    await userEvent.type(screen.getByLabelText(/full name/i), 'Test Visitor');
    await userEvent.type(screen.getByLabelText(/business email/i), 'visitor@example.com');
    await userEvent.type(screen.getByLabelText(/phone number/i), '+977 9800000000');
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    const input = await screen.findByLabelText(/attachment/i);
    await userEvent.upload(input, new File(['x'], 'virus.exe', { type: 'application/octet-stream' }), { applyAccept: false });
    expect(await screen.findByRole('alert')).toHaveTextContent(/unsupported file type/i);
  });
});
