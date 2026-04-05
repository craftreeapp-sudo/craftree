import { NextResponse } from 'next/server';
import { readSeedData, writeSeedData } from '@/lib/seed-data-fs';
import {
  RelationType as RT,
  type CraftingLink,
  type RelationType,
} from '@/lib/types';
import {
  createSupabaseServerReadClient,
  createSupabaseServiceRoleClient,
} from '@/lib/supabase-server';
import { requireAdminFromRequest } from '@/lib/auth-server';
import {
  fetchAllLinkRowsPaginated,
  fetchAllNodeIdsSet,
  GRAPH_LINKS_SELECT,
  mapLinkRowToCraftingLink,
} from '@/lib/data';
import { isSupabaseConfigured } from '@/lib/supabase-env-check';
import { linkEndpointsLockedFromSeed } from '@/lib/node-lock';

const JSON_NO_STORE = {
  headers: {
    'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
  },
} as const;

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
    if (!isSupabaseConfigured()) {
      const data = readSeedData();
      return NextResponse.json({ links: data.links });
    }
    const supabase = createSupabaseServerReadClient();
    const linkRows = await fetchAllLinkRowsPaginated(supabase, GRAPH_LINKS_SELECT);
    const links = linkRows.map((r) => mapLinkRowToCraftingLink(r));
    return NextResponse.json({ links }, JSON_NO_STORE);
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to read links' },
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

    if (!isSupabaseConfigured()) {
      const data = readSeedData();
      const nodeIds = new Set(data.nodes.map((n) => n.id));
      if (!nodeIds.has(source_id) || !nodeIds.has(target_id)) {
        return NextResponse.json(
          { error: 'source_id or target_id does not exist' },
          { status: 400 }
        );
      }
      if (linkEndpointsLockedFromSeed(data.nodes, source_id, target_id)) {
        return NextResponse.json({ error: 'node_locked' }, { status: 423 });
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
        is_optional: Boolean(body.is_optional),
        notes:
          typeof body.notes === 'string' && body.notes.trim()
            ? body.notes.trim()
            : undefined,
      };

      data.links.push(link);
      writeSeedData(data);
      return NextResponse.json({ link }, { status: 201 });
    }

    const admin = await requireAdminFromRequest();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sb = createSupabaseServiceRoleClient();
    const nodeIds = await fetchAllNodeIdsSet(sb);
    if (!nodeIds.has(source_id) || !nodeIds.has(target_id)) {
      return NextResponse.json(
        { error: 'source_id or target_id does not exist' },
        { status: 400 }
      );
    }

    const { data: lockRows } = await sb
      .from('nodes')
      .select('id, is_locked')
      .in('id', [source_id, target_id]);
    if (
      lockRows?.some(
        (r: { is_locked?: boolean }) => r.is_locked === true
      )
    ) {
      return NextResponse.json({ error: 'node_locked' }, { status: 423 });
    }

    const existingRows = await fetchAllLinkRowsPaginated(sb, '*');
    const dup = existingRows.some(
      (l) =>
        String(l.source_id) === source_id &&
        String(l.target_id) === target_id &&
        String(l.relation_type) === relation_type
    );
    if (dup) {
      return NextResponse.json(
        { error: 'Link already exists' },
        { status: 409 }
      );
    }

    const id = nextLinkId(
      existingRows.map((l) => mapLinkRowToCraftingLink(l))
    );

    const insertRow = {
      id,
      source_id,
      target_id,
      relation_type,
      is_optional: Boolean(body.is_optional),
      notes:
        typeof body.notes === 'string' && body.notes.trim()
          ? body.notes.trim()
          : null,
    };

    const { data: inserted, error } = await sb
      .from('links')
      .insert(insertRow)
      .select()
      .single();

    if (error) throw error;
    const link = mapLinkRowToCraftingLink(inserted as Record<string, unknown>);
    return NextResponse.json({ link }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to create link' },
      { status: 500 }
    );
  }
}
