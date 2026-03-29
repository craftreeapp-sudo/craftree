import { NextResponse } from 'next/server';
import { readSeedData, writeSeedData } from '@/lib/seed-data-fs';
import { normalizeInventionName, slugify } from '@/lib/utils';
import type { SeedNode } from '@/lib/types';
import {
  createSupabaseServerReadClient,
  createSupabaseServiceRoleClient,
} from '@/lib/supabase-server';
import { requireAdminFromRequest } from '@/lib/auth-server';
import {
  GRAPH_NODES_SELECT,
  mapGraphNodeRowToSeedNode,
  mapNodeRowToSeedNode,
} from '@/lib/data';
import { isSupabaseConfigured } from '@/lib/supabase-env-check';
import { dimensionMaterialLevelFromCreateBody } from '@/lib/node-dimension';

function uniqueIdFromName(base: string, existingIds: Set<string>): string {
  let id = slugify(base);
  if (!id) id = 'node';
  if (!existingIds.has(id)) return id;
  let n = 2;
  while (existingIds.has(`${id}-${n}`)) n += 1;
  return `${id}-${n}`;
}

const FULL_NODES_SELECT =
  'id, name, name_en, description, description_en, category, type, era, year_approx, origin, image_url, wikipedia_url, tags, complexity_depth, dimension, material_level';

export async function GET(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      const data = readSeedData();
      return NextResponse.json({ nodes: data.nodes });
    }
    const { searchParams } = new URL(request.url);
    const full =
      searchParams.get('full') === '1' || searchParams.get('full') === 'true';
    const supabase = createSupabaseServerReadClient();
    const sel = full ? FULL_NODES_SELECT : GRAPH_NODES_SELECT;
    const { data, error } = await supabase
      .from('nodes')
      // Colonnes alignées sur le schéma ; assertion pour éviter les unions trop strictes du client.
      .select(sel as never)
      .order('name');
    if (error) throw error;
    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    const nodes = rows.map((r) =>
      full ? mapNodeRowToSeedNode(r) : mapGraphNodeRowToSeedNode(r)
    );
    return NextResponse.json({ nodes });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to read nodes' },
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

    if (!isSupabaseConfigured()) {
      const data = readSeedData();
      const existingIds = new Set(data.nodes.map((n) => n.id));
      const normName = normalizeInventionName(name);
      if (
        data.nodes.some((n) => normalizeInventionName(n.name) === normName)
      ) {
        return NextResponse.json(
          {
            error: 'name_exists',
            message: 'Une invention avec ce nom existe déjà',
          },
          { status: 409 }
        );
      }
      let id: string;
      if (typeof body.id === 'string' && body.id.trim()) {
        const candidate = slugify(body.id) || uniqueIdFromName(name, existingIds);
        if (existingIds.has(candidate)) {
          return NextResponse.json(
            {
              error: 'id_exists',
              message: 'Une invention avec ce nom existe déjà',
            },
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
        typeof body.complexity_depth === 'number' &&
        Number.isFinite(body.complexity_depth)
          ? body.complexity_depth
          : 0;
      const dm = dimensionMaterialLevelFromCreateBody(body);
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
            : typeof body.wikipedia_url === 'string' &&
                body.wikipedia_url.trim()
              ? body.wikipedia_url.trim()
              : undefined,
        dimension: dm.dimension,
        materialLevel: dm.materialLevel,
      };
      data.nodes.push(node);
      writeSeedData(data);
      return NextResponse.json({ node }, { status: 201 });
    }

    const admin = await requireAdminFromRequest();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const sb = createSupabaseServiceRoleClient();
    const { data: existingRows } = await sb.from('nodes').select('id, name');
    const existingIds = new Set((existingRows ?? []).map((r) => String(r.id)));
    const normName = normalizeInventionName(name);
    if (
      (existingRows ?? []).some(
        (r) => normalizeInventionName(String(r.name)) === normName
      )
    ) {
      return NextResponse.json(
        {
          error: 'name_exists',
          message: 'Une invention avec ce nom existe déjà',
        },
        { status: 409 }
      );
    }

    let id: string;
    if (typeof body.id === 'string' && body.id.trim()) {
      const candidate = slugify(body.id) || uniqueIdFromName(name, existingIds);
      if (existingIds.has(candidate)) {
        return NextResponse.json(
          {
            error: 'id_exists',
            message: 'Une invention avec ce nom existe déjà',
          },
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
        ? null
        : Number(yearRaw);

    const complexity_depth =
      typeof body.complexity_depth === 'number' && Number.isFinite(body.complexity_depth)
        ? body.complexity_depth
        : 0;

    const dm = dimensionMaterialLevelFromCreateBody(body);

    const insertRow = {
      id,
      name,
      name_en:
        typeof body.name_en === 'string' ? body.name_en.trim() : name,
      description,
      description_en:
        typeof body.description_en === 'string'
          ? body.description_en.trim()
          : null,
      category: body.category,
      type: body.type,
      era: body.era,
      year_approx:
        year_approx !== null && Number.isFinite(year_approx)
          ? year_approx
          : null,
      complexity_depth,
      tags,
      origin:
        body.origin === null
          ? null
          : typeof body.origin === 'string' && body.origin.trim()
            ? body.origin.trim()
            : null,
      image_url:
        body.image_url === null
          ? null
          : typeof body.image_url === 'string' && body.image_url.trim()
            ? body.image_url.trim()
            : null,
      wikipedia_url:
        body.wikipedia_url === null
          ? null
          : typeof body.wikipedia_url === 'string' && body.wikipedia_url.trim()
            ? body.wikipedia_url.trim()
            : null,
      dimension: dm.dimension,
      material_level: dm.materialLevel,
    };

    const { data: inserted, error } = await sb
      .from('nodes')
      .insert(insertRow)
      .select()
      .single();

    if (error) throw error;
    const node = mapNodeRowToSeedNode(inserted as Record<string, unknown>);
    return NextResponse.json({ node }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: 'Failed to create node' },
      { status: 500 }
    );
  }
}
