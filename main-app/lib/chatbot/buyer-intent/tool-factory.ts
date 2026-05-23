import { z } from 'zod';

import type { BuyerIntentType } from '@/lib/chatbot/buyer-intent/types';
import type { BuyerIntentResult } from '@/lib/chatbot/buyer-intent/errors';
import {
  ToolContractBuilder,
  type ToolContract,
  policyQaToolInputSchema,
  policyQaToolOutputSchema,
  recommendationToolInputSchema,
  recommendationToolOutputSchema,
  refundRequestToolInputSchema,
  refundRequestToolOutputSchema,
} from '@/lib/chatbot/buyer-intent/tool-contracts';

export type RefundRequestToolInput = z.infer<typeof refundRequestToolInputSchema>;
export type RefundRequestToolOutput = z.infer<typeof refundRequestToolOutputSchema>;
export type RecommendationToolInput = z.infer<typeof recommendationToolInputSchema>;
export type RecommendationToolOutput = z.infer<typeof recommendationToolOutputSchema>;
export type PolicyQaToolInput = z.infer<typeof policyQaToolInputSchema>;
export type PolicyQaToolOutput = z.infer<typeof policyQaToolOutputSchema>;

export type BuyerToolContract = ToolContract<unknown, unknown>;

const refundRequestToolContract = new ToolContractBuilder<
  RefundRequestToolInput,
  RefundRequestToolOutput
>()
  .name('refund_request')
  .description('Submit a buyer refund request based on validated refund payload data.')
  .inputSchema(refundRequestToolInputSchema)
  .outputSchema(refundRequestToolOutputSchema)
  .build();

const recommendationToolContract = new ToolContractBuilder<
  RecommendationToolInput,
  RecommendationToolOutput
>()
  .name('product_recommendation')
  .description('Generate buyer-facing product recommendations based on intent and constraints.')
  .inputSchema(recommendationToolInputSchema)
  .outputSchema(recommendationToolOutputSchema)
  .build();

const policyQaToolContract = new ToolContractBuilder<PolicyQaToolInput, PolicyQaToolOutput>()
  .name('policy_qa')
  .description('Answer buyer policy questions with validated policy domain context.')
  .inputSchema(policyQaToolInputSchema)
  .outputSchema(policyQaToolOutputSchema)
  .build();

const toolByIntent: Record<BuyerIntentType, BuyerToolContract> = {
  REFUND_REQUEST: refundRequestToolContract,
  PRODUCT_RECOMMENDATION: recommendationToolContract,
  POLICY_QA: policyQaToolContract,
};

export class BuyerIntentToolFactory {
  getTool(intentType: BuyerIntentType): BuyerIntentResult<BuyerToolContract> {
    const tool = toolByIntent[intentType];

    if (!tool) {
      return {
        success: false,
        error: {
          code: 'TOOL_NOT_FOUND',
          message: `No tool registered for intent: ${intentType}`,
        },
      };
    }

    return { success: true, value: tool };
  }
}
