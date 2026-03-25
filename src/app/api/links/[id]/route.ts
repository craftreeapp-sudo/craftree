import { NextResponse } from 'next/server';
import { readSeedData, writeSeedData } from '@/lib/seed-data-fs';
import {
  RelationType as RT,
  type CraftingLink,
  type RelationType,
} from '@/lib/types';

const RELATIONS: RelationType[] = [
  RT.MATERIAL,
  RT.TOOL,
  RT.ENERGY,
  RT.KNOWLEDGE,
  RT.CATALYST,
];

function isRelationType(s: string): s is RelationType {
  return RELATIONS.includes(s as RelationType);
}

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const decoded = decodeURIComponent(id);
    const body = (await request.json()) as Partial<CraftingLink>;
    const data = readSeedData();
    const idx = data.links.findIndex((l) => l.id === decoded);
    if (idx === -1) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }

    const cur = data.links[idx]!;
    if (
      body.relation_type !== undefined &&
      !isRelationType(String(body.relation_type))
    ) {
      return NextResponse.json(
        { error: 'invalid relation_type' },
        { status: 400 }
      );
    }

    const merged: CraftingLink = {
      ...cur,
      ...body,
      id: cur.id,
      source_id: cur.source_id,
      target_id: cur.target_id,
      relation_type: (body.relation_type !== undefined
        ? body.relation_type
        : cur.relation_type) as RelationType,
      is_optional:
        body.is_optional !== undefined ? Boolean(body.is_optional) : cur.is_optional,
    };

    data.links[idx] = merged;
    writeSeedData(data);
    return NextResponse.json({ link: merged });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to update link' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const decoded = decodeURIComponent(id);
    const data = readSeedData();
    const before = data.links.length;
    data.links = data.links.filter((l) => l.id !== decoded);
    if (data.links.length === before) {
      return NextResponse.json({ error: 'Link not found' }, { status: 404 });
    }
    writeSeedData(data);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to delete link' },
      { status: 500 }
    );
  }
}
