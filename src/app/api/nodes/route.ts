import { NextResponse } from 'next/server';
import { readSeedData, writeSeedData } from '@/lib/seed-data-fs';
import { normalizeInventionName, slugify } from '@/lib/utils';
import type { SeedNode } from '@/lib/types';

function uniqueIdFromName(base: string, existingIds: Set<string>): string {
  let id = slugify(base);
  if (!id) id = 'node';
  if (!existingIds.has(id)) return id;
  let n = 2;
  while (existingIds.has(`${id}-${n}`)) n += 1;
  return `${id}-${n}`;
}

export async function GET() {
  try {
    const data = readSeedData();
    return NextResponse.json({ nodes: data.nodes });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to read seed data' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    const description =
      typeof body.description === 'string' ? body.description.trim() : '';
    if (
      typeof body.category !== 'string' ||
      typeof body.type !== 'string' ||
      typeof body.era !== 'string'
    ) {
      return NextResponse.json(
        { error: 'category, type, and era are required' },
        { status: 400 }
      );
    }

    const data = readSeedData();
    const existingIds = new Set(data.nodes.map((n) => n.id));
    const normName = normalizeInventionName(name);
    if (
      data.nodes.some((n) => normalizeInventionName(n.name) === normName)
    ) {
      return NextResponse.json(
        { error: 'name_exists', message: 'Une invention avec ce nom existe déjà' },
        { status: 409 }
      );
    }

    let id: string;
    if (typeof body.id === 'string' && body.id.trim()) {
      const candidate = slugify(body.id) || uniqueIdFromName(name, existingIds);
      if (existingIds.has(candidate)) {
        return NextResponse.json(
          { error: 'id_exists', message: 'Une invention avec ce nom existe déjà' },
          { status: 409 }
        );
      }
      id = candidate;
    } else {
      id = uniqueIdFromName(name, existingIds);
    }

    const rawTags = body.tags;
    const tags =
      typeof rawTags === 'string'
        ? rawTags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : Array.isArray(rawTags)
          ? rawTags.map(String)
          : [];

    const yearRaw = body.year_approx;
    const year_approx =
      yearRaw === null || yearRaw === undefined || yearRaw === ''
        ? undefined
        : Number(yearRaw);

    const complexity_depth =
      typeof body.complexity_depth === 'number' && Number.isFinite(body.complexity_depth)
        ? body.complexity_depth
        : 0;

    const node: SeedNode = {
      id,
      name,
      name_en: typeof body.name_en === 'string' ? body.name_en.trim() : name,
      description,
      category: body.category,
      type: body.type,
      era: body.era,
      year_approx:
        year_approx !== undefined && Number.isFinite(year_approx)
          ? year_approx
          : undefined,
      complexity_depth,
      tags,
      origin:
        body.origin === null
          ? undefined
          : typeof body.origin === 'string' && body.origin.trim()
            ? body.origin.trim()
            : undefined,
      image_url:
        body.image_url === null
          ? undefined
          : typeof body.image_url === 'string' && body.image_url.trim()
            ? body.image_url.trim()
            : undefined,
      wikipedia_url:
        body.wikipedia_url === null
          ? undefined
          : typeof body.wikipedia_url === 'string' && body.wikipedia_url.trim()
            ? body.wikipedia_url.trim()
            : undefined,
    };

    data.nodes.push(node);
    writeSeedData(data);
    return NextResponse.json({ node }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to create node' },
      { status: 500 }
    );
  }
}
