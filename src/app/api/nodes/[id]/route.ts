import { NextResponse } from 'next/server';
import { readSeedData, writeSeedData } from '@/lib/seed-data-fs';
import type { SeedNode } from '@/lib/types';

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const decoded = decodeURIComponent(id);
    const body = (await request.json()) as Record<string, unknown>;
    const data = readSeedData();
    const idx = data.nodes.findIndex((n) => n.id === decoded);
    if (idx === -1) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }

    const cur = data.nodes[idx]!;
    let tags: string[] = cur.tags;
    const rawTags = body.tags;
    if (Array.isArray(rawTags)) tags = rawTags.map(String);
    else if (typeof rawTags === 'string') {
      tags = rawTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
    }

    const merged: SeedNode = {
      ...cur,
      id: cur.id,
      name: typeof body.name === 'string' ? body.name.trim() : cur.name,
      description:
        typeof body.description === 'string' ? body.description : cur.description,
      name_en:
        typeof body.name_en === 'string' ? body.name_en.trim() : cur.name_en,
      category:
        typeof body.category === 'string' ? body.category : cur.category,
      type: typeof body.type === 'string' ? body.type : cur.type,
      era: typeof body.era === 'string' ? body.era : cur.era,
      tags,
      origin:
        typeof body.origin === 'string' ? body.origin.trim() : cur.origin,
      image_url:
        typeof body.image_url === 'string' ? body.image_url.trim() : cur.image_url,
      wikipedia_url:
        typeof body.wikipedia_url === 'string'
          ? body.wikipedia_url.trim()
          : cur.wikipedia_url,
    };

    if (body.year_approx !== undefined) {
      merged.year_approx =
        body.year_approx === null ? undefined : Number(body.year_approx);
    }

    data.nodes[idx] = merged;
    writeSeedData(data);
    return NextResponse.json({ node: merged });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to update node' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const decoded = decodeURIComponent(id);
    const data = readSeedData();
    const before = data.nodes.length;
    data.nodes = data.nodes.filter((n) => n.id !== decoded);
    if (data.nodes.length === before) {
      return NextResponse.json({ error: 'Node not found' }, { status: 404 });
    }
    data.links = data.links.filter(
      (l) => l.source_id !== decoded && l.target_id !== decoded
    );
    writeSeedData(data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to delete node' },
      { status: 500 }
    );
  }
}
