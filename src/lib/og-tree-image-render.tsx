/**
 * JSX pour next/og (Satori) — styles inline uniquement, pas de Tailwind.
 */
import type { CSSProperties } from 'react';
import type { RelationType } from '@/lib/types';
import type { BuiltUponBuckets } from '@/lib/built-upon-utils';
import type { DirectInputCard, OgLocale, OgTreePayload } from '@/lib/og-tree-invention-data';

const BG = '#08081a';
const GRID = '#1a1a2e';
const TEXT = '#ffffff';
const TEXT_SEC = '#9ca3af';
const TEXT_TER = '#6b7280';
const TEXT_DIS = '#374151';
const CARD_BG = '#111127';
const GREEN = '#1D9E75';
const GREEN_L = '#5DCAA5';
const ORANGE = '#D85A30';
const ORANGE_L = '#F0997B';
const AMBER = '#EF9F27';
const AMBER_L = '#FAC775';
const VIOLET = '#534AB7';
const VIOLET_L = '#AFA9EC';
const BLUE = '#378ADD';
const BLUE_L = '#85B7EB';

function relationColors(rt: RelationType): { border: string; text: string } {
  switch (rt) {
    case 'material':
      return { border: GREEN, text: GREEN_L };
    case 'tool':
      return { border: ORANGE, text: ORANGE_L };
    case 'energy':
      return { border: AMBER, text: AMBER_L };
    case 'knowledge':
    case 'catalyst':
      return { border: VIOLET, text: VIOLET_L };
    default:
      return { border: VIOLET, text: VIOLET_L };
  }
}

function relationLabel(rt: RelationType, locale: OgLocale): string {
  if (locale === 'en') {
    const en: Record<RelationType, string> = {
      material: 'Material',
      tool: 'Tool',
      energy: 'Energy',
      knowledge: 'Knowledge',
      catalyst: 'Catalyst',
    };
    return en[rt] ?? rt;
  }
  const fr: Record<RelationType, string> = {
    material: 'Matière',
    tool: 'Outil',
    energy: 'Énergie',
    knowledge: 'Savoir',
    catalyst: 'Catalyseur',
  };
  return fr[rt] ?? rt;
}

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function frenchFabricationQuestion(name: string): string {
  const t = name.trim();
  if (!t) return '?';
  const first = t[0]!.toLowerCase();
  if (/[aeiouàâäéèêëïîôùûœæhy]/i.test(first)) {
    return `de l'${t} ?`;
  }
  return `du ${t} ?`;
}

function gridBackgroundStyle(): CSSProperties {
  return {
    backgroundColor: BG,
    backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 47px, ${GRID} 47px, ${GRID} 48px), repeating-linear-gradient(90deg, transparent, transparent 47px, ${GRID} 47px, ${GRID} 48px)`,
  };
}

function CraftreeLogo(props: { size?: 'sm' | 'md' }) {
  const fs = props.size === 'md' ? 22 : 18;
  return (
    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'baseline' }}>
      <span style={{ color: TEXT, fontSize: fs, fontWeight: 600 }}>Craft</span>
      <span style={{ color: GREEN_L, fontSize: fs, fontWeight: 600 }}>ree</span>
    </div>
  );
}

function statsLine(
  upstreamCount: number,
  year: number | null | undefined,
  origin: string | undefined,
  locale: OgLocale
): string {
  const parts: string[] = [];
  if (locale === 'en') {
    parts.push(`${upstreamCount} upstream inventions`);
  } else {
    parts.push(`${upstreamCount} inventions en amont`);
  }
  if (year === null || year === undefined) {
    /* skip */
  } else {
    parts.push(String(year));
  }
  if (origin?.trim()) {
    parts.push(origin.trim());
  }
  return parts.join(' · ');
}

function OgFallback({ locale }: { locale: OgLocale }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: BG,
        padding: 48,
      }}
    >
      <CraftreeLogo size="md" />
      <p
        style={{
          marginTop: 24,
          color: TEXT_SEC,
          fontSize: 18,
          letterSpacing: 0.2,
          textAlign: 'center',
        }}
      >
        {locale === 'en'
          ? 'What is civilization made of?'
          : 'De quoi est faite la civilisation ?'}
      </p>
    </div>
  );
}

function RecipeCard({
  card,
  locale,
}: {
  card: DirectInputCard;
  locale: OgLocale;
}) {
  const { border, text } = relationColors(card.relation_type);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: 148,
        minHeight: 72,
        padding: 12,
        borderRadius: 8,
        backgroundColor: CARD_BG,
        borderWidth: 2,
        borderStyle: 'solid',
        borderColor: border,
      }}
    >
      <div
        style={{
          color: text,
          fontSize: 13,
          fontWeight: 600,
          textAlign: 'center',
          lineHeight: 1.25,
        }}
      >
        {truncate(card.name, 22)}
      </div>
      <div style={{ marginTop: 6, color: TEXT_TER, fontSize: 9, textAlign: 'center' }}>
        {relationLabel(card.relation_type, locale)}
      </div>
    </div>
  );
}

function OgRecipe(props: {
  name: string;
  year_approx?: number | null;
  origin?: string;
  upstreamCount: number;
  cards: DirectInputCard[];
  locale: OgLocale;
}) {
  const { name, year_approx, origin, upstreamCount, cards, locale } = props;

  const bigLine =
    locale === 'en'
      ? `${name}?`
      : frenchFabricationQuestion(name);

  const subtitle =
    locale === 'en'
      ? 'What does it take to make'
      : 'Que faut-il pour fabriquer';

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        position: 'relative',
        ...gridBackgroundStyle(),
      }}
    >
      <div
        style={{
          color: TEXT_SEC,
          fontSize: 14,
          textAlign: 'center',
          marginTop: 36,
          fontWeight: 400,
        }}
      >
        {subtitle}
      </div>
      <div
        style={{
          color: TEXT,
          fontSize: 42,
          fontWeight: 600,
          textAlign: 'center',
          marginTop: 12,
          paddingLeft: 48,
          paddingRight: 48,
          lineHeight: 1.25,
        }}
      >
        {truncate(bigLine, 48)}
      </div>
      <div
        style={{
          width: 48,
          height: 3,
          backgroundColor: GREEN_L,
          alignSelf: 'center',
          marginTop: 16,
          borderRadius: 2,
        }}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
          flexGrow: 1,
          gap: 10,
          marginTop: 28,
          paddingLeft: 40,
          paddingRight: 40,
        }}
      >
        {cards.map((c, i) => (
          <div
            key={`${c.name}-${i}`}
            style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 10 }}
          >
            {i > 0 ? (
              <span style={{ color: TEXT_TER, fontSize: 22, fontWeight: 600 }}>+</span>
            ) : null}
            <RecipeCard card={c} locale={locale} />
          </div>
        ))}
      </div>

      <div
        style={{
          color: TEXT_SEC,
          fontSize: 13,
          textAlign: 'center',
          marginTop: 16,
          paddingLeft: 48,
          paddingRight: 48,
        }}
      >
        {statsLine(upstreamCount, year_approx ?? null, origin, locale)}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          paddingLeft: 40,
          paddingRight: 40,
          paddingBottom: 32,
          marginTop: 'auto',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'baseline', gap: 12 }}>
          <CraftreeLogo />
          <span style={{ color: TEXT_DIS, fontSize: 12 }}>
            {locale === 'en'
              ? 'What is civilization made of?'
              : 'De quoi est faite la civilisation ?'}
          </span>
        </div>
        <span style={{ color: TEXT_DIS, fontSize: 12 }}>craftree.app</span>
      </div>
    </div>
  );
}

function matterRow(
  label: string,
  labelColor: string,
  borderColor: string,
  textColor: string,
  nodes: { name: string }[],
  max: number,
  widthPct: number
) {
  if (nodes.length === 0) return null;
  const slice = nodes.slice(0, max);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: `${widthPct}%`,
        alignSelf: 'center',
        marginTop: 8,
      }}
    >
      <div
        style={{
          alignSelf: 'flex-start',
          color: labelColor,
          fontSize: 11,
          fontWeight: 600,
          marginBottom: 6,
          letterSpacing: 0.5,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: 8,
        }}
      >
        {slice.map((n, i) => (
          <div
            key={`${label}-${i}-${n.name}`}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor,
              color: textColor,
              fontSize: 12,
              maxWidth: 200,
            }}
          >
            {truncate(n.name, 28)}
          </div>
        ))}
      </div>
    </div>
  );
}

function OgPyramid(props: {
  nodeId: string;
  name: string;
  year_approx?: number | null;
  origin?: string;
  upstreamCount: number;
  buckets: BuiltUponBuckets;
  locale: OgLocale;
}) {
  const { nodeId, name, year_approx, origin, upstreamCount, buckets, locale } = props;

  const processTools = [...buckets.process, ...buckets.tools];

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        backgroundColor: BG,
        paddingLeft: 24,
        paddingRight: 24,
        paddingTop: 20,
        paddingBottom: 24,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <CraftreeLogo size="md" />
        <span style={{ color: TEXT_TER, fontSize: 12 }}>
          {locale === 'en'
            ? 'What is civilization made of?'
            : 'De quoi est faite la civilisation ?'}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'center',
          marginBottom: 12,
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: 440,
            maxWidth: '100%',
            padding: 20,
            borderRadius: 12,
            backgroundColor: '#1e1e3e',
            borderWidth: 2,
            borderStyle: 'solid',
            borderColor: VIOLET,
          }}
        >
          <div
            style={{
              display: 'flex',
              color: TEXT,
              fontSize: 22,
              fontWeight: 600,
              textAlign: 'center',
            }}
          >
            {truncate(name, 40)}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          flexGrow: 1,
          gap: 0,
        }}
      >
        {matterRow(
          'COMPONENTS',
          VIOLET_L,
          VIOLET,
          VIOLET_L,
          buckets.matters.component,
          4,
          100
        )}
        {matterRow(
          'INDUSTRIAL',
          GREEN_L,
          GREEN,
          GREEN_L,
          buckets.matters.industrial,
          3,
          92
        )}
        {matterRow(
          'PROCESSED',
          BLUE_L,
          BLUE,
          BLUE_L,
          buckets.matters.processed,
          3,
          84
        )}
        {matterRow(
          'RAW',
          ORANGE_L,
          ORANGE,
          ORANGE_L,
          buckets.matters.raw,
          3,
          76
        )}

        {processTools.length > 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'row',
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 8,
              marginTop: 14,
              width: '100%',
            }}
          >
            {processTools.map((n) => (
              <div
                key={n.id}
                style={{
                  padding: '8px 12px',
                  borderRadius: 6,
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: TEXT_TER,
                  color: TEXT_SEC,
                  fontSize: 12,
                }}
              >
                {truncate(n.name, 32)}
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          borderTopWidth: 1,
          borderTopStyle: 'solid',
          borderTopColor: '#1f2937',
          marginTop: 12,
          paddingTop: 12,
        }}
      >
        <div
          style={{
            color: TEXT_SEC,
            fontSize: 13,
            textAlign: 'center',
          }}
        >
          {[
            year_approx !== null && year_approx !== undefined
              ? String(year_approx)
              : null,
            origin?.trim() ? origin.trim() : null,
            `${upstreamCount} ${locale === 'en' ? 'upstream inventions' : 'inventions en amont'}`,
          ]
            .filter(Boolean)
            .join(' · ')}
        </div>
        <div style={{ color: TEXT_DIS, fontSize: 12, textAlign: 'center', marginTop: 8 }}>
          {pyramidFooterUrl(nodeId)}
        </div>
      </div>
    </div>
  );
}

function pyramidFooterUrl(id: string) {
  return `craftree.app/tree/${encodeURIComponent(id)}`;
}

export function renderOgTreeImage(payload: OgTreePayload, id: string) {
  if (payload.kind === 'fallback') {
    return <OgFallback locale={payload.locale} />;
  }
  if (payload.kind === 'recipe') {
    return (
      <OgRecipe
        name={payload.name}
        year_approx={payload.year_approx}
        origin={payload.origin}
        upstreamCount={payload.upstreamCount}
        cards={payload.cards}
        locale={payload.locale}
      />
    );
  }
  return (
    <OgPyramid
      nodeId={id}
      name={payload.name}
      year_approx={payload.year_approx}
      origin={payload.origin}
      upstreamCount={payload.upstreamCount}
      buckets={payload.buckets}
      locale={payload.locale}
    />
  );
}
