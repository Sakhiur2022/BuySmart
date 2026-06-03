import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { getServiceRoleSupabase } from '@/lib/supabase/service-role';
import {
  REFUND_EVIDENCE_ALLOWED_TYPES,
  REFUND_EVIDENCE_BUCKET,
  REFUND_EVIDENCE_MAX_BYTES,
  REFUND_EVIDENCE_MAX_FILES,
  validateRefundEvidenceFile,
} from '@/lib/types/refund-evidence.types';

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '-').toLowerCase();
}

function buildStoragePath(userId: string, orderId: string | null, fileName: string): string {
  const safeName = sanitizeFileName(fileName);
  const prefix = orderId ? `refunds/${userId}/${orderId}` : `refunds/${userId}`;
  return `${prefix}/${Date.now()}-${safeName}`;
}

async function ensureRefundEvidenceBucket(): Promise<string | null> {
  const admin = getServiceRoleSupabase();

  if (!admin) {
    return 'Storage administration is not configured.';
  }

  const { data: buckets, error: listError } = await admin.storage.listBuckets();

  if (listError) {
    return listError.message || 'Failed to inspect storage buckets.';
  }

  if (buckets?.some((bucket) => bucket.name === REFUND_EVIDENCE_BUCKET)) {
    return null;
  }

  const { error: createError } = await admin.storage.createBucket(REFUND_EVIDENCE_BUCKET, {
    public: true,
    allowedMimeTypes: [...REFUND_EVIDENCE_ALLOWED_TYPES],
    fileSizeLimit: REFUND_EVIDENCE_MAX_BYTES,
  });

  if (createError) {
    return createError.message || 'Failed to create refund evidence bucket.';
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const formData = await request.formData();
    const orderId = formData.get('orderId');
    const files = formData.getAll('files').filter(Boolean) as File[];

    if (!files.length) {
      return NextResponse.json({ error: 'No files uploaded.' }, { status: 400 });
    }

    if (files.length > REFUND_EVIDENCE_MAX_FILES) {
      return NextResponse.json(
        { error: `You can upload up to ${REFUND_EVIDENCE_MAX_FILES} images.` },
        { status: 400 },
      );
    }

    for (const file of files) {
      const validation = validateRefundEvidenceFile(file);
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.reason || 'Invalid file.' },
          { status: 400 },
        );
      }

      if (file.size > REFUND_EVIDENCE_MAX_BYTES) {
        return NextResponse.json(
          { error: `File exceeds ${Math.round(REFUND_EVIDENCE_MAX_BYTES / (1024 * 1024))}MB.` },
          { status: 400 },
        );
      }
    }

    const uploadedPaths: string[] = [];
    const publicUrls: string[] = [];
    const safeOrderId = typeof orderId === 'string' && orderId.trim() ? orderId.trim() : null;

    const bucketError = await ensureRefundEvidenceBucket();

    if (bucketError) {
      return NextResponse.json({ error: bucketError }, { status: 500 });
    }

    for (const file of files) {
      const storagePath = buildStoragePath(user.id, safeOrderId, file.name);
      const bytes = await file.arrayBuffer();

      const { error: uploadError } = await supabase.storage
        .from(REFUND_EVIDENCE_BUCKET)
        .upload(storagePath, bytes, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        if (uploadedPaths.length > 0) {
          await supabase.storage.from(REFUND_EVIDENCE_BUCKET).remove(uploadedPaths);
        }

        return NextResponse.json(
          { error: uploadError.message || 'Failed to upload evidence.' },
          { status: 500 },
        );
      }

      uploadedPaths.push(storagePath);
      const { data } = supabase.storage.from(REFUND_EVIDENCE_BUCKET).getPublicUrl(storagePath);
      publicUrls.push(data.publicUrl);
    }

    return NextResponse.json({ urls: publicUrls });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload evidence.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
