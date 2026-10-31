import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import App from './App';
import { api, ApiError } from './services/api';
import { StatusBadge } from './components/common/StatusBadge';
import { SeverityBadge } from './components/common/SeverityBadge';
import { Button } from './components/common/Button';
import { Modal } from './components/common/Modal';
import { EmptyState } from './components/common/EmptyState';
import { SkeletonLoader } from './components/common/SkeletonLoader';

const mockStaffUser = {
  id: 'usr_staff_001',
  username: 'pharmacist_demo',
  email: 'pharmacist_demo@pharmacyguard.local',
  full_name: 'Dr. Alex Mercer, PharmD',
  roles: ['staff_pharmacist'],
  is_active: true,
};

const mockChiefUser = {
  id: 'usr_chief_001',
  username: 'chief_demo',
  email: 'chief_demo@pharmacyguard.local',
  full_name: 'Dr. Sarah Lin, PharmD, BCPS',
  roles: ['chief_pharmacist'],
  is_active: true,
};

const mockStudentUser = {
  id: 'usr_student_001',
  username: 'student_demo',
  email: 'student_demo@pharmacyguard.local',
  full_name: 'Jordan Taylor',
  roles: ['pharmacy_student'],
  is_active: true,
};

describe('PharmacyGuard Stage 1: Foundation & Authentication', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders application branding, advisory disclaimer, and login screen when unauthenticated', async () => {
    render(<App />);

    // Advisory Banner
    expect(screen.getByText(/DEMONSTRATION PROTOTYPE ONLY:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Advisory deterministic rule engine with synthetic clinical data/i)
    ).toBeInTheDocument();

    // Login screen heading
    expect(screen.getByRole('heading', { level: 2, name: /PharmacyGuard Workstation/i })).toBeInTheDocument();

    // Input fields
    expect(screen.getByLabelText(/Workstation Username/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In to Workstation/i })).toBeInTheDocument();

    // Demo role fast-fill cards
    expect(screen.getByText(/Live Demo Workstation Profiles/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: /Staff Pharmacist/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: /Chief Pharmacist/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 4, name: /Pharmacy Student/i })).toBeInTheDocument();
  });

  it('authenticates through the API client and renders the authenticated shell', async () => {
    // Mock login endpoint
    vi.spyOn(api.auth, 'login').mockResolvedValueOnce({
      access_token: 'fake_jwt_token_staff',
      token_type: 'bearer',
      expires_in_minutes: 60,
      user: mockStaffUser,
    });

    render(<App />);

    const submitBtn = screen.getByRole('button', { name: /Sign In to Workstation/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getAllByText(/Alex Mercer/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/@pharmacist_demo/i)).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /Staff Pharmacist Workstation/i })).toBeInTheDocument();
    });

    expect(api.getToken()).toBe('fake_jwt_token_staff');
  });

  it('switches demo roles through real backend authentication', async () => {
    // Seed an authenticated staff session
    localStorage.setItem('pharmacyguard_access_token', 'initial_token');
    vi.spyOn(api.auth, 'me').mockResolvedValueOnce(mockStaffUser);

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText(/Alex Mercer/i).length).toBeGreaterThan(0);
    });

    // Mock switching to Chief Pharmacist
    vi.spyOn(api.auth, 'login').mockResolvedValueOnce({
      access_token: 'fake_jwt_token_chief',
      token_type: 'bearer',
      expires_in_minutes: 60,
      user: mockChiefUser,
    });

    const chiefSwitchBtn = screen.getByRole('button', { name: /Chief Pharmacist/i });
    fireEvent.click(chiefSwitchBtn);

    await waitFor(() => {
      expect(screen.getAllByText(/Dr\. Sarah Lin/i).length).toBeGreaterThan(0);
      expect(screen.getByText(/@chief_demo/i)).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 2, name: /Chief Pharmacist Workstation/i })).toBeInTheDocument();
    });

    expect(api.auth.login).toHaveBeenCalledWith({
      username: 'chief_demo',
      password: 'ChiefDemoPassword2026!',
    });
  });

  it('logs out and clears session state on logout button click', async () => {
    localStorage.setItem('pharmacyguard_access_token', 'active_token');
    vi.spyOn(api.auth, 'me').mockResolvedValueOnce(mockStaffUser);
    vi.spyOn(api.auth, 'logout').mockResolvedValueOnce({
      status: 'logged_out',
      message: 'Client session terminated.',
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText(/Alex Mercer/i).length).toBeGreaterThan(0);
    });

    const logoutBtn = screen.getByRole('button', { name: /Log out/i });
    fireEvent.click(logoutBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /PharmacyGuard Workstation/i })).toBeInTheDocument();
    });

    expect(api.getToken()).toBeNull();
  });

  it('displays error message when login fails with invalid credentials', async () => {
    vi.spyOn(api.auth, 'login').mockRejectedValueOnce(
      new ApiError(401, 'Invalid username or password')
    );

    render(<App />);

    const submitBtn = screen.getByRole('button', { name: /Sign In to Workstation/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Invalid username or password/i)).toBeInTheDocument();
    });
  });

  it('authenticates directly when clicking a demo role profile card', async () => {
    vi.spyOn(api.auth, 'login').mockResolvedValueOnce({
      access_token: 'fake_jwt_token_student',
      token_type: 'bearer',
      expires_in_minutes: 60,
      user: mockStudentUser,
    });

    render(<App />);

    // Click "Authenticate" on student card
    const studentAuthButtons = screen.getAllByRole('button', { name: /Authenticate/i });
    // Index 2 is Pharmacy Student
    fireEvent.click(studentAuthButtons[2]);

    await waitFor(() => {
      expect(screen.getAllByText(/Jordan Taylor/i).length).toBeGreaterThan(0);
      expect(screen.getByRole('heading', { level: 2, name: /Pharmacy Student Workstation/i })).toBeInTheDocument();
    });

    expect(api.auth.login).toHaveBeenCalledWith({
      username: 'student_demo',
      password: 'StudentDemoPassword2026!',
    });
  });
});

describe('PharmacyGuard Stage 1: Reusable UI Primitives', () => {
  it('renders StatusBadge with accessible classes and text', () => {
    const { rerender } = render(<StatusBadge status="pending" />);
    expect(screen.getByText('Pending Review')).toBeInTheDocument();

    rerender(<StatusBadge status="reviewed" />);
    expect(screen.getByText('Accepted')).toBeInTheDocument();

    rerender(<StatusBadge status="overridden" />);
    expect(screen.getByText('Overridden')).toBeInTheDocument();

    rerender(<StatusBadge status="escalated" />);
    expect(screen.getByText('Escalated to Chief')).toBeInTheDocument();

    rerender(<StatusBadge status="IN_STOCK" />);
    expect(screen.getByText('In Stock')).toBeInTheDocument();

    rerender(<StatusBadge status="OUT_OF_STOCK" />);
    expect(screen.getByText('Out of Stock')).toBeInTheDocument();
  });

  it('renders SeverityBadge with correct severity labels', () => {
    const { rerender } = render(<SeverityBadge severity="HIGH" />);
    expect(screen.getByText('HIGH SEVERITY')).toBeInTheDocument();

    rerender(<SeverityBadge severity="MODERATE" />);
    expect(screen.getByText('MODERATE')).toBeInTheDocument();

    rerender(<SeverityBadge severity="LOW" />);
    expect(screen.getByText('LOW')).toBeInTheDocument();

    rerender(<SeverityBadge severity="INFO" />);
    expect(screen.getByText('INFO')).toBeInTheDocument();
  });

  it('renders Button with variants and loading state', () => {
    const handleClick = vi.fn();
    const { rerender } = render(
      <Button variant="primary" onClick={handleClick}>
        Click Me
      </Button>
    );

    const btn = screen.getByRole('button', { name: /Click Me/i });
    fireEvent.click(btn);
    expect(handleClick).toHaveBeenCalledTimes(1);

    rerender(
      <Button variant="primary" isLoading onClick={handleClick}>
        Click Me
      </Button>
    );
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });

  it('renders Modal when isOpen is true and closes via Escape key', () => {
    const handleClose = vi.fn();
    const { rerender } = render(
      <Modal isOpen={false} onClose={handleClose} title="Test Modal">
        <p>Modal content</p>
      </Modal>
    );

    expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();

    rerender(
      <Modal isOpen={true} onClose={handleClose} title="Test Modal">
        <p>Modal content</p>
      </Modal>
    );

    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('Modal content')).toBeInTheDocument();

    // Fire Escape key
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('renders EmptyState and SkeletonLoader without crashing', () => {
    const { rerender } = render(
      <EmptyState
        title="No Records Found"
        description="Try adjusting your search criteria."
        action={{ label: 'Reset', onClick: () => {} }}
      />
    );

    expect(screen.getByText('No Records Found')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your search criteria.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reset/i })).toBeInTheDocument();

    rerender(<SkeletonLoader type="table" count={2} />);
    expect(screen.getByRole('status', { name: /Loading data/i })).toBeInTheDocument();
  });
});
