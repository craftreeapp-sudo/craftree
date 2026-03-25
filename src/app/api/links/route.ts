import { NextResponse } from 'next/server';
import { readSeedData, writeSeedData } from '@/lib/seed-data-fs';
import { RelationType as RT, type CraftingLink, type RelationType } from '@/lib/types';

function nextLinkId(links: CraftingLink[]): string {
  let max = 0;
  for (const l of links) {
    const m = /^l(\d+)$/.exec(l.id);
    if (m) max = Math.max(max, parseInt(m[1]!, 10));
  }
  return `l${max + 1}`;
}

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

export async function GET() {
  try {
    const data = readSeedData();
    return NextResponse.json({ links: data.links });
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
    const body = (await request.json()) as Partial<CraftingLink>;
    const source_id = typeof body.source_id === 'string' ? body.source_id : '';
    const target_id = typeof body.target_id === 'string' ? body.target_id : '';
    const relation_type = body.relation_type;

    if (!source_id || !target_id) {
      return NextResponse.json(
        { error: 'source_id and target_id are required' },
        { status: 400 }
      );
    }
    if (source_id === target_id) {
      return NextResponse.json(
        { error: 'source_id and target_id must differ' },
        { status: 400 }
      );
    }
    if (!relation_type || !isRelationType(String(relation_type))) {
      return NextResponse.json(
        { error: 'valid relation_type is required' },
        { status: 400 }
      );
    }

    const data = readSeedData();
    const nodeIds = new Set(data.nodes.map((n) => n.id));
    if (!nodeIds.has(source_id) || !nodeIds.has(target_id)) {
      return NextResponse.json(
        { error: 'source_id or target_id does not exist' },
        { status: 400 }
      );
    }

    const dup = data.links.some(
      (l) =>
        l.source_id === source_id &&
        l.target_id === target_id &&
        l.relation_type === relation_type
    );
    if (dup) {
      return NextResponse.json(
        { error: 'Link already exists' },
        { status: 409 }
      );
    }

    const id = nextLinkId(data.links);
    const link: CraftingLink = {
      id,
      source_id,
      target_id,
      relation_type: relation_type as RelationType,
      quantity_hint:
        typeof body.quantity_hint === 'string' && body.quantity_hint.trim()
          ? body.quantity_hint.trim()
          : undefined,
      is_optional: Boolean(body.is_optional),
      notes:
        typeof body.notes === 'string' && body.notes.trim()
          ? body.notes.trim()
          : undefined,
    };

    data.links.push(link);
    writeSeedData(data);
    return NextResponse.json({ link }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to create link' },
      { status: 500 }
    );
  }
}
