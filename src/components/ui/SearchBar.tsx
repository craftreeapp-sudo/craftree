'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Fuse from 'fuse.js';
import { useIsMobileBreakpoint } from '@/hooks/use-media-query';
import { useExploreNavigation } from '@/hooks/use-explore-navigation';
import { getCategoryColor } from '@/lib/colors';
import { formatYear, getPlaceholderImage } from '@/lib/utils';
import { eraLabelFromMessages } from '@/lib/era-display';
import type { Era, NodeCategory } from '@/lib/types';
import { useGraphStore } from '@/stores/graph-store';
import { getTreeLayerDisplayIndex } from '@/lib/tree-layers';
import { pickNodeDisplayName } from '@/lib/node-display-name';
import { safeCategoryLabel } from '@/lib/safe-category-label';
import { getNameEnForNode } from '@/lib/name-en-lookup';
import { trackEvent } from '@/lib/analytics';

interface SearchNode {
  id: string;
  name: string;
  name_en?: string;
  category: string;
  era: string;
  type: string;
  complexity_depth: number;
  year_approx?: number | null;
  tags: string[];
}

const MAX_RESULTS = 8;

export type SearchBarNavigateOptions = {
  center?: boolean;
};

function treeLayerForSearchNode(n: SearchNode): number {
  if (n.type === 'raw_material') return 0;
  return n.complexity_depth ?? 0;
}

export function SearchBar({
  placeholder,
  variant = 'default',
  landingCtaLabel,
  navigateOptions,
  className: rootClassName,
}: {
  placeholder?: string;
  variant?: 'default' | 'landing';
  landingCtaLabel?: string;
  navigateOptions?: SearchBarNavigateOptions;
  className?: string;
} = {}) {
  const locale = useLocale();
  const tc = useTranslations('common');
  const tCat = useTranslations('categories');
  const tTypes = useTranslations('types');
  const tExplore = useTranslations('explore');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchNode[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { navigateToNode } = useExploreNavigation();
  const pathname = usePathname();
  const isMobile = useIsMobileBreakpoint();
  const exploreMobileSearch =
    (pathname?.startsWith('/tree/') ?? false) && isMobile;

  const graphNodes = useGraphStore((s) => s.nodes);
  const nodes = useMemo(
    () =>
      graphNodes.map((n) => ({
        id: n.id,
        name: n.name,
        name_en: n.name_en?.trim() || getNameEnForNode(n.id),
        category: n.category,
        era: n.era,
        type: n.type,
        complexity_depth: n.complexity_depth,
        year_approx: n.year_approx ?? null,
        tags: n.tags,
      })) as SearchNode[],
    [graphNodes]
  );

  const defaultSortedNodes = useMemo(
    () => [...nodes].sort((a, b) => a.name.localeCompare(b.name, 'fr')),
    [nodes]
  );

  const fuse = useMemo(
    () =>
      new Fuse(nodes, {
        keys: [
          { name: 'name', weight: 2 },
          { name: 'name_en', weight: 2 },
          { name: 'tags', weight: 1 },
          { name: 'category', weight: 0.8 },
          { name: 'era', weight: 0.35 },
        ],
        threshold: 0.4,
        includeScore: true,
      }),
    [nodes]
  );

  const search = useCallback(
    (q: string) => {
      if (!q.trim()) {
        setResults(defaultSortedNodes.slice(0, MAX_RESULTS));
        setHighlightedIndex(0);
        return;
      }
      trackEvent('search', undefined, { query: q.trim() });
      const searchResults = fuse.search(q);
      setResults(
        searchResults.slice(0, MAX_RESULTS).map((r) => r.item)
      );
      setHighlightedIndex(0);
    },
    [fuse, defaultSortedNodes]
  );

  useEffect(() => {
    const timer = setTimeout(() => search(query), 150);
    return () => clearTimeout(timer);
  }, [query, search]);

  const goToFocusedView = useCallback(
    (node: SearchNode) => {
      const isLanding = variant === 'landing';
      navigateToNode(node.id, {
        center: navigateOptions?.center ?? !isLanding,
        ...(exploreMobileSearch ? { exploreMode: 'root' as const } : {}),
      });
      setQuery('');
      setResults([]);
      setDropdownOpen(false);
      inputRef.current?.blur();
    },
    [navigateToNode, exploreMobileSearch, variant, navigateOptions]
  );

  const handleLandingCta = useCallback(() => {
    const target = results[highlightedIndex] ?? results[0];
    if (target) goToFocusedView(target);
  }, [results, highlightedIndex, goToFocusedView]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
        setQuery('');
        inputRef.current?.blur();
        e.preventDefault();
        return;
      }
      if (!dropdownOpen || results.length === 0) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((i) => Math.min(i + 1, results.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' && results[highlightedIndex]) {
        e.preventDefault();
        goToFocusedView(results[highlightedIndex]);
      }
    },
    [dropdownOpen, results, highlightedIndex, goToFocusedView]
  );

  useEffect(() => {
    if (variant === 'landing') return;
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [variant]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isLanding = variant === 'landing';

  const resultsList = results.map((node, index) => {
    const categoryColor = getCategoryColor(node.category as NodeCategory);
    const displayName = pickNodeDisplayName(
      locale,
      node.name,
      getNameEnForNode(node.id)
    );
    const thumb = getPlaceholderImage(
      node.category as NodeCategory,
      node.name
    );
    const yearStr = formatYear(node.year_approx ?? undefined);
    const layerIdx = getTreeLayerDisplayIndex(treeLayerForSearchNode(node));
    const rowHighlight =
      index === highlightedIndex
        ? isLanding
          ? 'bg-white/10'
          : 'bg-border/80'
        : isLanding
          ? 'hover:bg-white/5'
          : 'hover:bg-border/50';
    return (
      <button
        key={node.id}
        type="button"
        onClick={() => goToFocusedView(node)}
        className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors ${rowHighlight}`}
      >
        <span
          className={`relative mt-0.5 h-8 w-8 shrink-0 overflow-hidden rounded-md border bg-surface ${
            isLanding ? 'border-white/15' : 'border-border'
          }`}
        >
          <Image
            src={thumb}
            alt=""
            width={32}
            height={32}
            className="h-full w-full object-cover"
            unoptimized
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`truncate font-medium ${
                isLanding ? 'text-white' : 'text-foreground'
              }`}
            >
              {displayName}
            </span>
            <span
              className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium capitalize"
              style={{
                backgroundColor: `${categoryColor}30`,
                color: categoryColor,
              }}
            >
              {safeCategoryLabel(tCat, node.category, tTypes)}
            </span>
          </div>
          <div
            className={`mt-0.5 flex flex-wrap gap-x-2 text-[11px] ${
              isLanding ? 'text-white/55' : 'text-muted-foreground'
            }`}
          >
            {yearStr ? (
              <>
                <span>{yearStr}</span>
                <span className="opacity-50">·</span>
              </>
            ) : null}
            <span>{tExplore('layerShort', { layer: layerIdx })}</span>
            <span className="opacity-50">·</span>
            <span>{eraLabelFromMessages(locale, node.era as Era)}</span>
          </div>
        </div>
      </button>
    );
  });

  const dropdown = dropdownOpen ? (
    <div
      className={`absolute left-0 right-0 top-full z-50 overflow-auto py-1 ${
        isLanding
          ? 'mt-2 max-h-[min(42vh,340px)] rounded-xl border border-white/10 bg-[#101018]/95 shadow-2xl backdrop-blur-md'
          : 'mt-1 max-h-[320px] rounded-lg border border-border bg-surface-elevated/95 backdrop-blur-md'
      }`}
      aria-live="polite"
    >
      {results.length === 0 ? (
        <div
          className={`px-4 py-3 text-sm ${
            isLanding ? 'text-white/50' : 'text-muted-foreground'
          }`}
        >
          {tc('noResults')}
        </div>
      ) : (
        resultsList
      )}
    </div>
  ) : null;

  if (isLanding) {
    return (
      <div
        ref={containerRef}
        className={`relative w-full max-w-2xl ${rootClassName ?? ''}`}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2.5 backdrop-blur-sm sm:py-3">
            <svg
              className="h-4 w-4 shrink-0 text-white/45"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => {
                setDropdownOpen(true);
                search(query);
              }}
              placeholder={placeholder ?? tc('search')}
              className="w-full bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={handleLandingCta}
            className="shrink-0 rounded-xl bg-[#3b5bdb] px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-[#4c6ef5] sm:px-6 sm:py-3"
          >
            {landingCtaLabel ?? tc('explore')}
          </button>
        </div>
        {dropdown}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative w-full min-w-0 max-w-none ${rootClassName ?? ''}`}
    >
      <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-elevated/90 px-4 py-2.5 backdrop-blur-md">
        <svg
          className="h-4 w-4 shrink-0 text-muted-foreground"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setDropdownOpen(true);
            search(query);
          }}
          placeholder={placeholder ?? tc('search')}
          className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <kbd className="hidden rounded border border-border bg-surface px-1.5 py-0.5 text-xs text-muted-foreground sm:inline-block">
          ⌘K
        </kbd>
      </div>
      {dropdown}
    </div>
  );
}
