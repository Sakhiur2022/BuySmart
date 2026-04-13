import { vi } from 'vitest';

export const invokeGroqChainMock = vi.fn();

export function mockGroqChainSuccess(text: string, model = 'test-model') {
  invokeGroqChainMock.mockResolvedValue({
    text,
    model,
    usage: {
      promptTokens: 10,
      completionTokens: 12,
      totalTokens: 22,
    },
  });
}

export function mockGroqChainFailure(message = 'mocked chain failure') {
  invokeGroqChainMock.mockRejectedValue(new Error(message));
}

export function createGroqCompletionChainMock() {
  return {
    invoke: invokeGroqChainMock,
  };
}
