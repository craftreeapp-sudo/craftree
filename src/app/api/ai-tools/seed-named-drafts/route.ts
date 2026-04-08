import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAdminFromRequest, getRouteHandlerUser } from '@/lib/auth-server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase-server';
import { isSupabaseConfigured } from '@/lib/supabase-env-check';
import { fetchAllNodeIdsSet, isMissingNatureColumnsError } from '@/lib/data';
import { dimensionMaterialLevelFromCreateBody } from '@/lib/node-dimension';
import {
  naturalOriginAppToDb,
  parseChemicalNature,
  parseNaturalOrigin,
} from '@/lib/suggest-nature-fields';
import { slugify } from '@/lib/utils';
import { Era, NodeCategory, type NodeDimension } from '@/lib/types';
import {
  completeAiOperation,
  startAiOperation,
} from '@/lib/ai-tools/operations-log';

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_NAMES = 40;

const CATEGORIES = new Set<string>(Object.values(NodeCategory));
const ERAS = new Set<string>(Object.values(Era));

function parseJsonObject(text: string): Record<string, unknown> | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]!) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function uniqueNodeId(
  sb: SupabaseClient,
  base: string,
  reserved: Set<string>
): Promise<string> {
  const existing = await fetchAllNodeIdsSet(sb);
  let id = slugify(base);
  if (!id) id = 'node';
  const has = (x: string) => existing.has(x) || reserved.has(x);
  if (!has(id)) {
    reserved.add(id);
    return id;
  }
  let n = 2;
  while (has(`${id}-${n}`)) n += 1;
  const out = `${id}-${n}`;
  reserved.add(out);
  return out;
}

function clampYear(y: unknown): number | null {
  if (y === null || y === undefined || y === '') return null;
  const n = Number(y);
  if (!Number.isFinite(n)) return null;
  if (n < -10000 || n > 2030) return null;
  return n;
}

type CardPayload = {
  name: string;
  name_en?: string;
  description?: string;
  description_en?: string;
  category: string;
  era: string;
  year_approx?: number | null;
  dimension?: string;
  materialLevel?: string;
  naturalOrigin?: string;
  chemicalNature?: string;
};

export async function POST(request: Request) {
  let opId: string | null = null;
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Supabase requis' }, { status: 503 });
    }
    if (!process.env.ANTHROPIC_API_KEY?.trim()) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY manquant' },
        { status: 503 }
      );
    }
    const admin = await requireAdminFromRequest();
    if (!admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as { names?: unknown };
    const rawNames = Array.isArray(body.names) ? body.names : [];
    const names = [
      ...new Set(
        rawNames
          .map((x) => String(x).trim())
          .filter((s) => s.length > 0)
          .slice(0, MAX_NAMES)
      ),
    ];
    if (names.length === 0) {
      return NextResponse.json(
        { error: 'Au moins un nom requis' },
        { status: 400 }
      );
    }

    const sb = createSupabaseServiceRoleClient();
    const skippedExisting: string[] = [];
    const toCreate: string[] = [];

    for (const name of names) {
      const { data: row } = await sb
        .from('nodes')
        .select('id')
        .eq('name', name)
        .maybeSingle();
      if (row && typeof (row as { id?: string }).id === 'string') {
        skippedExisting.push(name);
      } else {
        toCreate.push(name);
      }
    }

    if (toCreate.length === 0) {
      return NextResponse.json({
        created: [] as { id: string; name: string }[],
        skippedExisting,
        errors: [] as string[],
        message: 'Toutes les entrées existent déjà ou sont ambiguës',
      });
    }

    const user = await getRouteHandlerUser();
    opId = await startAiOperation({
      tool: 'seed_named_drafts',
      paramsJson: { count: toCreate.length, names: toCreate },
      createdByUserId: user?.id ?? null,
    });

    const namesJson = JSON.stringify(toCreate);
    const system = `Tu complètes des fiches « invention » pour Craftree. Réponds UNIQUEMENT par un objet JSON valide, sans markdown.

Schéma:
{
  "cards": [
    {
      "name": "string (nom FR exactement comme demandé)",
      "name_en": "string",
      "description": "court paragraphe FR",
      "description_en": "short EN",
      "category": "une valeur Craftree parmi les catégories officielles",
      "era": "prehistoric|ancient|medieval|renaissance|industrial|modern|digital|contemporary",
      "year_approx": nombre ou null entre -10000 et 2030,
      "dimension": "matter|composant|tool|energy|process|infrastructure",
      "materialLevel": "raw|processed|industrial|component" si dimension matter, sinon null,
      "naturalOrigin": "mineral|plant|animal" si pertinent (matter),
      "chemicalNature": "element|compound|material" si pertinent (matter)
    }
  ]
}

Contraintes: exactement ${toCreate.length} entrée(s). Chaque "name" doit correspondre exactement à un des noms demandés (liste fournie par l'utilisateur).`;

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: 120_000,
    });

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8192,
      system,
      messages: [
        {
          role: 'user',
          content: `Noms à traiter (exactement ces libellés pour le champ name) :\n${namesJson}\n\nRemplis les champs pour chaque fiche et réponds avec le JSON.`,
        },
      ],
    });

    const block = response.content[0];
    const text =
      block?.type === 'text' ? block.text : JSON.stringify(response.content);
    const parsed = parseJsonObject(text);
    const rawCards = parsed?.cards;
    if (!Array.isArray(rawCards)) {
      await completeAiOperation(opId, {
        status: 'failed',
        results: { error: 'JSON invalide' },
      });
      return NextResponse.json(
        { error: 'Réponse IA invalide (cards manquantes)' },
        { status: 422 }
      );
    }

    const byName = new Map<string, CardPayload>();
    for (const item of rawCards) {
      if (!item || typeof item !== 'object') continue;
      const o = item as Record<string, unknown>;
      const name = typeof o.name === 'string' ? o.name.trim() : '';
      if (!name || !toCreate.includes(name)) continue;
      const category =
        typeof o.category === 'string' && CATEGORIES.has(o.category.trim())
          ? o.category.trim()
          : NodeCategory.ENERGY;
      const era =
        typeof o.era === 'string' && ERAS.has(o.era.trim())
          ? o.era.trim()
          : 'modern';
      byName.set(name, {
        name,
        name_en: typeof o.name_en === 'string' ? o.name_en.trim() : undefined,
        description:
          typeof o.description === 'string' ? o.description.trim() : '',
        description_en:
          typeof o.description_en === 'string' ? o.description_en.trim() : '',
        category,
        era,
        year_approx: clampYear(o.year_approx),
        dimension: typeof o.dimension === 'string' ? o.dimension.trim() : undefined,
        materialLevel:
          typeof o.materialLevel === 'string' ? o.materialLevel.trim() : undefined,
        naturalOrigin:
          typeof o.naturalOrigin === 'string' ? o.naturalOrigin.trim() : undefined,
        chemicalNature:
          typeof o.chemicalNature === 'string' ? o.chemicalNature.trim() : undefined,
      });
    }

    const errors: string[] = [];
    const created: { id: string; name: string }[] = [];
    const reserved = new Set<string>();

    for (const name of toCreate) {
      const inv = byName.get(name);
      if (!inv) {
        errors.push(`${name} : absent de la réponse IA`);
        continue;
      }

      const bodyDm = dimensionMaterialLevelFromCreateBody({
        dimension: inv.dimension ?? null,
        materialLevel: inv.materialLevel ?? null,
      });
      let dm = bodyDm;
      if (dm.dimension === null) {
        dm = { dimension: 'matter' as NodeDimension, materialLevel: 'component' };
      }

      const naturalOrigin = parseNaturalOrigin(inv.naturalOrigin);
      const chemicalNature = parseChemicalNature(inv.chemicalNature);

      try {
        const id = await uniqueNodeId(sb, inv.name, reserved);
        const insertRow = {
          id,
          name: inv.name.slice(0, 500),
          name_en: (inv.name_en || inv.name).slice(0, 500),
          description: inv.description ?? '',
          description_en: inv.description_en ? inv.description_en.slice(0, 8000) : null,
          category: inv.category,
          type: inv.category,
          era: inv.era,
          year_approx: inv.year_approx ?? null,
          origin: null,
          image_url: null,
          wikipedia_url: null,
          tags: [] as string[],
          complexity_depth: 0,
          dimension: dm.dimension,
          material_level: dm.materialLevel,
          natural_origin:
            naturalOrigin === '' ? null : naturalOriginAppToDb(naturalOrigin),
          chemical_nature: chemicalNature === '' ? null : chemicalNature,
          is_draft: true,
        };

        const first = await sb.from('nodes').insert(insertRow).select().single();
        let insErr = first.error;
        if (insErr && isMissingNatureColumnsError(insErr)) {
          const {
            natural_origin: _a,
            chemical_nature: _b,
            ...rest
          } = insertRow;
          const retry = await sb.from('nodes').insert(rest).select().single();
          insErr = retry.error;
        }
        if (insErr) {
          errors.push(`${inv.name}: ${insErr.message}`);
          continue;
        }
        created.push({ id, name: inv.name });
      } catch (e) {
        errors.push(`${name}: ${String(e)}`);
      }
    }

    await completeAiOperation(opId, {
      status: 'completed',
      cardsProcessed: created.length,
      cardsModified: created.length,
      results: { skippedExisting, errors },
    });

    return NextResponse.json({
      created,
      skippedExisting,
      errors,
    });
  } catch (e) {
    console.error(e);
    await completeAiOperation(opId, {
      status: 'failed',
      results: { error: String(e) },
    });
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'seed-named-drafts failed' },
      { status: 500 }
    );
  }
}
