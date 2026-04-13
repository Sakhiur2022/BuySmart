import { vi } from 'vitest';

interface SupabaseResponse<T> {
  data: T;
  error: { message: string } | null;
  count?: number | null;
}

export function createSupabaseQueryBuilderMock<T>(response: SupabaseResponse<T>) {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue(response),
    single: vi.fn().mockResolvedValue(response),
    maybeSingle: vi.fn().mockResolvedValue(response),
  };

  return builder;
}

export function createSupabaseClientMock(tableBuilders: Record<string, unknown>) {
  return {
    from: vi.fn((tableName: string) => tableBuilders[tableName]),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            id: 'user-test-1',
          },
        },
        error: null,
      }),
    },
  };
}
