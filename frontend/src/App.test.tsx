import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
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
    api.setToken(null);
    window.history.pushState({}, '', '/');
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    api.setToken(null);
    window.history.pushState({}, '', '/');
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
      expect(screen.getAllByText(/@pharmacist_demo/i).length).toBeGreaterThan(0);
      expect(screen.getByRole('heading', { level: 2, name: /Staff Pharmacist Workstation/i })).toBeInTheDocument();
    });

    expect(api.getToken()).toBe('fake_jwt_token_staff');
  });

  it('switches demo roles through real backend authentication', async () => {
    localStorage.setItem('pharmacyguard_access_token', 'initial_token');
    vi.spyOn(api.auth, 'me').mockResolvedValueOnce(mockStaffUser);

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText(/Alex Mercer/i).length).toBeGreaterThan(0);
    });

    vi.spyOn(api.auth, 'login').mockResolvedValueOnce({
      access_token: 'fake_jwt_token_chief',
      token_type: 'bearer',
      expires_in_minutes: 60,
      user: mockChiefUser,
    });

    const chiefSwitchBtn = screen.getByRole('button', { name: /Chief/i });
    fireEvent.click(chiefSwitchBtn);

    await waitFor(() => {
      expect(screen.getAllByText(/Dr\. Sarah Lin/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/@chief_demo/i).length).toBeGreaterThan(0);
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

    const logoutButtons = screen.getAllByRole('button', { name: /Log out/i });
    fireEvent.click(logoutButtons[0]);

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

    const studentAuthButtons = screen.getAllByRole('button', { name: /Authenticate/i });
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

describe('PharmacyGuard Stage 1: Session Restoration & Token Expiration', () => {
  beforeEach(() => {
    localStorage.clear();
    api.setToken(null);
    window.history.pushState({}, '', '/');
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    api.setToken(null);
    window.history.pushState({}, '', '/');
    vi.restoreAllMocks();
  });

  it('restores authenticated session on page reload when valid token is stored', async () => {
    localStorage.setItem('pharmacyguard_access_token', 'valid_stored_token');
    const meSpy = vi.spyOn(api.auth, 'me').mockResolvedValueOnce(mockStaffUser);

    render(<App />);

    await waitFor(() => {
      expect(meSpy).toHaveBeenCalledTimes(1);
      expect(screen.getAllByText(/Alex Mercer/i).length).toBeGreaterThan(0);
      expect(screen.getByRole('heading', { level: 2, name: /Staff Pharmacist Workstation/i })).toBeInTheDocument();
    });

    expect(api.getToken()).toBe('valid_stored_token');
  });

  it('restores Chief Pharmacist role on page reload', async () => {
    localStorage.setItem('pharmacyguard_access_token', 'valid_chief_token');
    vi.spyOn(api.auth, 'me').mockResolvedValueOnce(mockChiefUser);

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText(/Dr\. Sarah Lin/i).length).toBeGreaterThan(0);
      expect(screen.getByRole('heading', { level: 2, name: /Chief Pharmacist Workstation/i })).toBeInTheDocument();
    });
  });

  it('clears invalid token on reload and renders unauthenticated login view', async () => {
    localStorage.setItem('pharmacyguard_access_token', 'invalid_or_expired_token');
    vi.spyOn(api.auth, 'me').mockRejectedValueOnce(
      new ApiError(401, 'Could not validate credentials')
    );

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /PharmacyGuard Workstation/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/Workstation Username/i)).toBeInTheDocument();
    });

    expect(api.getToken()).toBeNull();
  });
});

describe('PharmacyGuard Stage 1: HTTP 401 Handling & Simultaneous Eviction', () => {
  beforeEach(() => {
    localStorage.clear();
    api.setToken(null);
    api.reset401State();
    window.history.pushState({}, '', '/');
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    api.setToken(null);
    api.reset401State();
    window.history.pushState({}, '', '/');
    vi.restoreAllMocks();
  });

  it('clears stored token, invalidates session, and redirects to login when 401 occurs', async () => {
    localStorage.setItem('pharmacyguard_access_token', 'active_session_token');
    vi.spyOn(api.auth, 'me').mockResolvedValueOnce(mockStaffUser);

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText(/Alex Mercer/i).length).toBeGreaterThan(0);
    });

    // Simulate an API call returning 401
    act(() => {
      api.notifyUnauthorized();
    });

    await waitFor(() => {
      expect(api.getToken()).toBeNull();
      expect(screen.getByRole('heading', { level: 2, name: /PharmacyGuard Workstation/i })).toBeInTheDocument();
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Your session has expired or authentication failed/i)).toBeInTheDocument();
    });
  });

  it('handles multiple simultaneous 401 responses cleanly without duplicate notification flapping', async () => {
    const handler = vi.fn();
    const unsubscribe = api.onUnauthorized(handler);

    api.setToken('simultaneous_token');
    expect(api.getToken()).toBe('simultaneous_token');

    // Fire 3 simultaneous 401 notifications in parallel
    act(() => {
      api.notifyUnauthorized();
      api.notifyUnauthorized();
      api.notifyUnauthorized();
    });

    expect(api.getToken()).toBeNull();
    // Due to debouncing lock, handler should only be called once
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('simulates expired token response with automatic logout and login redirection', async () => {
    localStorage.setItem('pharmacyguard_access_token', 'expired_jwt_token');
    vi.spyOn(api.auth, 'me').mockResolvedValueOnce(mockStaffUser);

    render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText(/Alex Mercer/i).length).toBeGreaterThan(0);
    });

    // Simulate token expiration on subsequent request
    act(() => {
      api.notifyUnauthorized();
    });

    await waitFor(() => {
      expect(api.getToken()).toBeNull();
      expect(screen.getByRole('heading', { level: 2, name: /PharmacyGuard Workstation/i })).toBeInTheDocument();
      expect(screen.getByText(/Your session has expired or authentication failed/i)).toBeInTheDocument();
    });
  });
});

describe('PharmacyGuard Stage 1: Role-Based Route Protection & Dual Safety Boundary', () => {
  beforeEach(() => {
    localStorage.clear();
    api.setToken(null);
    window.history.pushState({}, '', '/');
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    api.setToken(null);
    window.history.pushState({}, '', '/');
    vi.restoreAllMocks();
  });

  it('displays AccessDeniedView when Staff Pharmacist directly navigates to chief workspace (?workspace=chief)', async () => {
    localStorage.setItem('pharmacyguard_access_token', 'staff_token');
    window.history.pushState({}, '', '/?workspace=chief');
    vi.spyOn(api.auth, 'me').mockResolvedValueOnce(mockStaffUser);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /Access Denied: Restricted Workspace/i })).toBeInTheDocument();
      expect(screen.getByText(/HTTP 403 · ACCESS CONTROL REJECTION/i)).toBeInTheDocument();
      expect(screen.getByText(/Dual Safety Boundary Active/i)).toBeInTheDocument();
    });

    // Return to authorized workspace
    const returnBtn = screen.getByRole('button', { name: /Return to Authorized Workspace/i });
    fireEvent.click(returnBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /Staff Pharmacist Workstation/i })).toBeInTheDocument();
    });
  });

  it('allows switching directly to the required demo role from AccessDeniedView', async () => {
    localStorage.setItem('pharmacyguard_access_token', 'staff_token');
    window.history.pushState({}, '', '/?workspace=chief');
    vi.spyOn(api.auth, 'me').mockResolvedValueOnce(mockStaffUser);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /Access Denied: Restricted Workspace/i })).toBeInTheDocument();
    });

    vi.spyOn(api.auth, 'login').mockResolvedValueOnce({
      access_token: 'fake_jwt_token_chief',
      token_type: 'bearer',
      expires_in_minutes: 60,
      user: mockChiefUser,
    });

    const switchBtn = screen.getByRole('button', { name: /Switch to Chief Pharmacist Account/i });
    fireEvent.click(switchBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /Chief Pharmacist Workstation/i })).toBeInTheDocument();
    });
  });

  it('displays AccessDeniedView when Pharmacy Student navigates to staff workspace (?workspace=staff)', async () => {
    localStorage.setItem('pharmacyguard_access_token', 'student_token');
    window.history.pushState({}, '', '/?workspace=staff');
    vi.spyOn(api.auth, 'me').mockResolvedValueOnce(mockStudentUser);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /Access Denied: Restricted Workspace/i })).toBeInTheDocument();
      expect(screen.getByText(/HTTP 403 · ACCESS CONTROL REJECTION/i)).toBeInTheDocument();
    });
  });

  it('displays AccessDeniedView when Pharmacy Student navigates to chief workspace (?workspace=chief)', async () => {
    localStorage.setItem('pharmacyguard_access_token', 'student_token');
    window.history.pushState({}, '', '/?workspace=chief');
    vi.spyOn(api.auth, 'me').mockResolvedValueOnce(mockStudentUser);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /Access Denied: Restricted Workspace/i })).toBeInTheDocument();
      expect(screen.getByText(/HTTP 403 · ACCESS CONTROL REJECTION/i)).toBeInTheDocument();
    });
  });

  it('displays AccessDeniedView when Chief Pharmacist navigates to student simulation (?workspace=student)', async () => {
    localStorage.setItem('pharmacyguard_access_token', 'chief_token');
    window.history.pushState({}, '', '/?workspace=student');
    vi.spyOn(api.auth, 'me').mockResolvedValueOnce(mockChiefUser);

    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 2, name: /Access Denied: Restricted Workspace/i })).toBeInTheDocument();
      expect(screen.getByText(/HTTP 403 · ACCESS CONTROL REJECTION/i)).toBeInTheDocument();
    });
  });

  it('verifies API client correctly extracts HTTP 403 Forbidden errors from server responses', async () => {
    // Test that ApiError extracts status 403 and error detail
    const error403 = new ApiError(403, "Forbidden: action requires one of the following roles: chief_pharmacist");
    expect(error403.status).toBe(403);
    expect(error403.message).toContain('Forbidden');
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
