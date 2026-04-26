import AdminRefundQueue from '../refund-queue';

// Mock data - replace with actual data fetching
const mockItems = [
  {
    id: '1',
    order_id: 'ORD-001',
    buyer_name: 'John Doe',
    amount: 150.00,
    reason: 'Product damaged',
    ai_decision: 'auto_approve' as const,
    ai_risk_score: 0.2,
    status: 'pending' as const,
    submitted_at: '2024-01-01T10:00:00Z',
  },
  {
    id: '2',
    order_id: 'ORD-002',
    buyer_name: 'Jane Smith',
    amount: 75.50,
    reason: 'Wrong item received',
    ai_decision: 'manual_review' as const,
    ai_risk_score: 0.5,
    status: 'approved' as const,
    submitted_at: '2024-01-02T11:00:00Z',
  },
  {
    id: '3',
    order_id: 'ORD-003',
    buyer_name: 'Bob Johnson',
    amount: 200.00,
    reason: 'Changed mind',
    ai_decision: 'auto_reject' as const,
    ai_risk_score: 0.8,
    status: 'rejected' as const,
    submitted_at: '2024-01-03T12:00:00Z',
  },
];

export default function RefundQueuePage() {
  return <AdminRefundQueue initialItems={mockItems} />;
}