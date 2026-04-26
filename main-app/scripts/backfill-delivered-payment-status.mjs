import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });
config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DRY_RUN = process.argv.includes('--dry-run');

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

async function main() {
  const baseQuery = supabase
    .from('orders')
    .select('order_id, status, payment_status', { count: 'exact' })
    .in('status', ['delivered', 'completed'])
    .neq('payment_status', 'paid');

  const { data: candidates, count, error: selectError } = await baseQuery;

  if (selectError) {
    throw selectError;
  }

  const totalCandidates = count ?? candidates?.length ?? 0;
  console.log(`Found ${totalCandidates} delivered/completed orders with payment_status not equal to paid.`);

  if (totalCandidates === 0) {
    return;
  }

  if (DRY_RUN) {
    console.log('Dry run requested, no rows updated.');
    return;
  }

  const { data: updatedRows, error: updateError } = await supabase
    .from('orders')
    .update({ payment_status: 'paid' })
    .in('status', ['delivered', 'completed'])
    .neq('payment_status', 'paid')
    .select('order_id');

  if (updateError) {
    throw updateError;
  }

  console.log(`Updated ${updatedRows?.length ?? 0} orders to payment_status=paid.`);
}

main().catch((error) => {
  console.error('Backfill failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
