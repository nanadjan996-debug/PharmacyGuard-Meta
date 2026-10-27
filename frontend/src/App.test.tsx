import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

describe('PharmacyGuard Scaffold', () => {
  it('renders application branding and header', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1, name: /PharmacyGuard/i })).toBeInTheDocument();
  });

  it('displays the non-clinical demonstration advisory banner', () => {
    render(<App />);
    expect(screen.getByText(/DEMONSTRATION PROTOTYPE ONLY/i)).toBeInTheDocument();
    expect(screen.getByText(/Rule-Based Engine/i)).toBeInTheDocument();
  });

  it('renders role switcher options', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /Staff Pharmacist/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chief Pharmacist/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Student Mode/i })).toBeInTheDocument();
  });
});
