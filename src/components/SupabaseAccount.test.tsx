// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SupabaseSignIn } from './SupabaseAccount';
import { SupabaseConnection } from '../hooks/useSupabaseConnection';

afterEach(cleanup);

function form(signInWithOtp: ReturnType<typeof vi.fn>) {
  const connection = { authReady: true, client: { auth: { signInWithOtp } } } as unknown as SupabaseConnection;
  render(<SupabaseSignIn connection={connection} />);
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'owner@example.invalid' } });
  return screen.getByRole('button', { name: 'Email sign-in link' });
}

describe('Existing-owner email sign-in', () => {
  it('requests existing-user sign-in with the application redirect', async () => {
    const signIn = vi.fn().mockResolvedValue({ error: null });
    fireEvent.click(form(signIn));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Check your email'));
    expect(signIn).toHaveBeenCalledOnce();
    expect(signIn).toHaveBeenCalledWith({ email: 'owner@example.invalid', options: {
      shouldCreateUser: false, emailRedirectTo: new URL('.', window.location.href).href,
    } });
  });

  it.each([
    new Error('No account exists for private@example.invalid'),
    { message: 'Signups disabled', code: 'signup_disabled' },
  ])('shows a usable generic error and allows retry without exposing provider details', async error => {
    const signIn = vi.fn().mockResolvedValueOnce({ error }).mockResolvedValue({ error: null });
    const button = form(signIn);
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Could not send a sign-in link. Use your existing account email and try again shortly.'));
    expect((button as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Check your email'));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(signIn).toHaveBeenCalledTimes(2);
  });
});
