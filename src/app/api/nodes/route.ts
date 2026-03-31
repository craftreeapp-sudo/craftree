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
  mapGraphNodeRowToSeedNode,
  mapNodeRowToSeedNode,
  fetchNodesOrdered,
  isMissingNatureColumnsError,
} from '@/lib/data';
import { isSupabaseConfigured } from '@/lib/supabase-env-check';
import { dimensionMaterialLevelFromCreateBody } from '@/lib/node-dimension';
import {
  parseChemicalNature,
  parseNaturalOrigin,
} from '@/lib/suggest-nature-fields';

const JSON_NO_STORE = {
  headers: {
    'Cache-Control': 'private, no-store, max-age=0, must-revalidate',
  },
} as const;

function uniqueIdFromName(base: string, existingIds: Set<string>): string {
  let id = slugify(base);
  if (!id) id = 'node';
  if (!existingIds.has(id)) return id;
  let n = 2;
  while (existingIds.has(`${id}-${n}`)) n += 1;
  return `${id}-${n}`;
}

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
    const { rows } = await fetchNodesOrdered(
      supabase,
      full ? 'full' : 'graph'
    );
    const nodes = rows.map((r) =>
      full ? mapNodeRowToSeedNode(r) : mapGraphNodeRowToSeedNode(r)
    );
    return NextResponse.json({ nodes }, JSON_NO_STORE);
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
      const naturalOrigin = parseNaturalOrigin(
        typeof body.naturalOrigin === 'string' ? body.naturalOrigin : undefined
      );
      const chemicalNature = parseChemicalNature(
        typeof body.chemicalNature === 'string'
          ? body.chemicalNature
          : undefined
      );
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
        ...(naturalOrigin !== ''
          ? { naturalOrigin }
          : {}),
        ...(chemicalNature !== ''
          ? { chemicalNature }
          : {}),
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
    const naturalOrigin = parseNaturalOrigin(
      typeof body.naturalOrigin === 'string' ? body.naturalOrigin : undefined
    );
    const chemicalNature = parseChemicalNature(
      typeof body.chemicalNature === 'string' ? body.chemicalNature : undefined
    );

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
      natural_origin: naturalOrigin === '' ? null : naturalOrigin,
      chemical_nature: chemicalNature === '' ? null : chemicalNature,
    };

    const firstAttempt = await sb
      .from('nodes')
      .insert(insertRow)
      .select()
      .single();
    let insErr = firstAttempt.error;
    let insData = firstAttempt.data;

    if (insErr && isMissingNatureColumnsError(insErr)) {
      const {
        natural_origin: _no,
        chemical_nature: _cn,
        ...insertWithoutNature
      } = insertRow;
      const retry = await sb
        .from('nodes')
        .insert(insertWithoutNature)
        .select()
        .single();
      insErr = retry.error;
      insData = retry.data;
    }

    if (insErr) throw insErr;
    const insertedRow = insData as Record<string, unknown>;

    const node = mapNodeRowToSeedNode(insertedRow);
    return NextResponse.json({ node }, { status: 201 });
  } catch (e) {
    console.error(e);
    const msg =
      e &&
      typeof e === 'object' &&
      'message' in e &&
      typeof (e as { message?: unknown }).message === 'string'
        ? String((e as { message: string }).message)
        : e instanceof Error
          ? e.message
          : 'Failed to create node';
    return NextResponse.json(
      { error: 'Failed to create node', message: msg },
      { status: 500 }
    );
  }
}
