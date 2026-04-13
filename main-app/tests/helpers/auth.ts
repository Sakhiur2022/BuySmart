import { vi } from 'vitest';

export const requireAuthenticatedUserMock = vi.fn();

export function mockAuthenticatedUser(userId = 'user-test-1') {
  requireAuthenticatedUserMock.mockResolvedValue({ userId });
}

export function mockUnauthenticatedUser() {
  requireAuthenticatedUserMock.mockRejectedValue(new Error('UNAUTHENTICATED'));
}
