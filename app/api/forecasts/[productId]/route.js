import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import {
  generateForecast,
  getLatestForecast,
} from '@/lib/forecast/service';
import { onProductChanged } from '@/lib/events';

export async function GET(request, { params }) {
  const auth = await requireUser();

  if (auth.response) {
    return auth.response;
  }

  const { productId } = await params;

  const result = await getLatestForecast(
    auth.supabase,
    productId
  );

  return NextResponse.json(result.body, {
    status: result.status,
  });
}

export async function POST(request, { params }) {
  const auth = await requireUser();

  if (auth.response) {
    return auth.response;
  }

  const { productId } = await params;

  const result = await generateForecast(
    auth.supabase,
    productId
  );

  // A new forecast can change the reorder recommendation (REORDER alert).
  if (result.status === 201) {
    await onProductChanged(auth.supabase, productId);
  }

  return NextResponse.json(result.body, {
    status: result.status,
  });
}