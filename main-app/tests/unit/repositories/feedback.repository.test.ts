import { describe, expect, it, vi } from 'vitest';

import { createSupabaseClientMock, createSupabaseQueryBuilderMock } from '@/tests/mocks/supabase';

vi.mock('@/lib/supabase/service-role', () => ({
  getServiceRoleSupabase: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { getServiceRoleSupabase } from '@/lib/supabase/service-role';
import { createClient } from '@/lib/supabase/server';
import { updateFeedbackSentimentAnalysisById } from '@/lib/repositories/feedback.repository';
import { buildFeedback, buildSentimentPersistenceInput } from '@/tests/factories/feedback.factory';

describe('updateFeedbackSentimentAnalysisById', () => {
  it('updates ai sentiment fields using service-role client when available', async () => {
    const feedback = buildFeedback();
    const query = createSupabaseQueryBuilderMock({ data: feedback, error: null });
    const supabaseClient = createSupabaseClientMock({ feedback: query });

    vi.mocked(getServiceRoleSupabase).mockReturnValue(supabaseClient as never);
    vi.mocked(createClient).mockResolvedValue(supabaseClient as never);

    const result = await updateFeedbackSentimentAnalysisById(
      feedback.feedback_id,
      buildSentimentPersistenceInput(),
    );

    expect(getServiceRoleSupabase).toHaveBeenCalledOnce();
    expect(query.update).toHaveBeenCalledOnce();
    expect(result.feedback_id).toBe(feedback.feedback_id);
  });
});
