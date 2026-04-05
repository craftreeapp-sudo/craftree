import { NextResponse } from 'next/server';
import { requireAdminFromRequest } from '@/lib/auth-server';
import { readSeedData, writeSeedData } from '@/lib/seed-data-fs';
import { isSupabaseConfigured } from '@/lib/supabase-env-check';
import { createSupabaseServiceRoleClient } from '@/lib/supabase-server';
import { fetchFullNodeRowById, mapNodeRowToSeedNode } from '@/lib/data';
import { seedNodeIsLocked } from '@/lib/node-lock';
import {
  fetchWikipediaImageUrl,
  searchWikipediaImage,
} from '@/lib/wikimedia-fetch';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: Request, ctx: Ctx) {
  const admin = await requireAdminFromRequest();
  if (!admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: rawId } = await ctx.params;
  const id = decodeURIComponent(rawId);

  let name: string;
  let nameEn: string;
  let wikipediaUrl: string | null | undefined;

  if (!isSupabaseConfigured()) {
    const data = readSeedData();
    const n = data.nodes.find((x) => x.id === id);
    if (!n) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }
    if (seedNodeIsLocked(n)) {
      return NextResponse.json({ error: 'node_locked' }, { status: 423 });
    }
    name = n.name;
    nameEn = n.name_en ?? n.name;
    wikipediaUrl = n.wikipedia_url;
  } else {
    const sb = createSupabaseServiceRoleClient();
    const row = await fetchFullNodeRowById(sb, id);
    if (!row) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }
    const n = mapNodeRowToSeedNode(row as unknown as Record<string, unknown>);
    if (seedNodeIsLocked(n)) {
      return NextResponse.json({ error: 'node_locked' }, { status: 423 });
    }
    name = n.name;
    nameEn = n.name_en ?? n.name;
    wikipediaUrl = n.wikipedia_url;
  }

  let imageUrl: string | null = null;
  if (wikipediaUrl?.trim()) {
    imageUrl = await fetchWikipediaImageUrl(wikipediaUrl.trim());
  }
  if (!imageUrl) {
    imageUrl = await searchWikipediaImage(name, nameEn);
  }
  if (!imageUrl) {
    return NextResponse.json(
      { error: 'wikimedia_no_image' },
      { status: 404 }
    );
  }

  if (!isSupabaseConfigured()) {
    const data = readSeedData();
    const idx = data.nodes.findIndex((n) => n.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }
    data.nodes[idx] = { ...data.nodes[idx]!, image_url: imageUrl };
    writeSeedData(data);
    return NextResponse.json({ image_url: imageUrl, success: true });
  }

  const sb = createSupabaseServiceRoleClient();
  const { error } = await sb
    .from('nodes')
    .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }

  return NextResponse.json({ image_url: imageUrl, success: true });
}
