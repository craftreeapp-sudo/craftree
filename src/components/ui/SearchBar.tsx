'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import Fuse from 'fuse.js';
import { useUIStore } from '@/stores/ui-store';
import { useIsMobileBreakpoint } from '@/hooks/use-media-query';
import { useExploreNavigation } from '@/hooks/use-explore-navigation';
import { getCategoryColor } from '@/lib/colors';
import { formatYear, getPlaceholderImage } from '@/lib/utils';
import type { NodeCategory } from '@/lib/types';
import { useGraphStore } from '@/stores/graph-store';
import { getTreeLayerShortLabel } from '@/lib/tree-layers';

interface SearchNode {
  id: string;
  name: string;
  category: string;
  era: string;
  type: string;
  complexity_depth: number;
  year_approx?: number | null;
  tags: string[];
}

const MAX_RESULTS = 8;
const ERA_LABELS: Record<string, string> = {
  prehistoric: 'Préhistorique',
  ancient: 'Antiquité',
  medieval: 'Moyen Âge',
  renaissance: 'Renaissance',
  industrial: 'Industriel',
  modern: 'Moderne',
  digital: 'Numérique',
  contemporary: 'Contemporain',
};

function formatEra(era: string): string {
  return ERA_LABELS[era] ?? era;
}

function treeLayerForSearchNode(n: SearchNode): number {
  if (n.type === 'raw_material') return 0;
  return n.complexity_depth ?? 0;
}

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchNode[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { navigateToNode } = useExploreNavigation();
  const closeSidebarKeepGraphHover = useUIStore(
    (s) => s.closeSidebarKeepGraphHover
  );
  const setExploreHoveredNodeId = useUIStore((s) => s.setExploreHoveredNodeId);
  const requestExploreNeighborhoodFit = useUIStore(
    (s) => s.requestExploreNeighborhoodFit
  );
  const pathname = usePathname();
  const isMobile = useIsMobileBreakpoint();
  const exploreMobileSearch = pathname === '/explore' && isMobile;

  const graphNodes = useGraphStore((s) => s.nodes);
  const nodes = useMemo(
    () =>
      graphNodes.map((n) => ({
        id: n.id,
        name: n.name,
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
      const searchResults = fuse.search(q);
      setResults(
        searchResults.slice(0, MAX_RESULTS).map((r) => r.item)
      );
      setHighlightedIndex(0);
    },
    [fuse, defaultSortedNodes]
  );

  useEffect(() => {
    const timer = setTimeout(() => search(query), 100);
    return () => clearTimeout(timer);
  }, [query, search]);

  const handleTreeReveal = useCallback(
    (node: SearchNode) => {
      router.replace('/explore');
      closeSidebarKeepGraphHover();
      setExploreHoveredNodeId(node.id);
      requestExploreNeighborhoodFit(node.id);
      setQuery('');
      setResults([]);
      setDropdownOpen(false);
      inputRef.current?.blur();
    },
    [
      router,
      closeSidebarKeepGraphHover,
      setExploreHoveredNodeId,
      requestExploreNeighborhoodFit,
    ]
  );

  const handleFocusView = useCallback(
    (node: SearchNode) => {
      navigateToNode(node.id, {
        center: true,
        ...(exploreMobileSearch ? { exploreMode: 'root' as const } : {}),
      });
      setQuery('');
      setResults([]);
      setDropdownOpen(false);
      inputRef.current?.blur();
    },
    [navigateToNode, exploreMobileSearch]
  );

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
        handleTreeReveal(results[highlightedIndex]);
      }
    },
    [dropdownOpen, results, highlightedIndex, handleTreeReveal]
  );

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

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

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      <div
        className="flex items-center gap-2 rounded-lg border border-[#2A3042] bg-[#1A1F2E]/90 px-4 py-2.5 backdrop-blur-md"
        style={{ backgroundColor: 'rgba(26, 31, 46, 0.9)' }}
      >
        <svg
          className="h-4 w-4 shrink-0 text-[#8B95A8]"
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
          placeholder="Rechercher une technologie..."
          className="w-full bg-transparent text-sm text-[#E8ECF4] placeholder:text-[#8B95A8] focus:outline-none"
        />
        <kbd className="hidden rounded border border-[#2A3042] bg-[#111827] px-1.5 py-0.5 text-xs text-[#8B95A8] sm:inline-block">
          ⌘K
        </kbd>
      </div>

      {dropdownOpen && (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[320px] overflow-auto rounded-lg border border-[#2A3042] py-1"
          style={{
            backgroundColor: 'rgba(26, 31, 46, 0.95)',
            backdropFilter: 'blur(12px)',
          }}
          aria-live="polite"
        >
          {results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-[#8B95A8]">
              Aucun résultat
            </div>
          ) : (
            results.map((node, index) => {
              const categoryColor = getCategoryColor(
                node.category as NodeCategory
              );
              const thumb = getPlaceholderImage(
                node.category as NodeCategory,
                node.name
              );
              const yearStr = formatYear(node.year_approx ?? undefined);
              return (
                <div
                  key={node.id}
                  className={`flex w-full items-stretch gap-0 transition-colors ${
                    index === highlightedIndex
                      ? 'bg-[#2A3042]/80'
                      : 'hover:bg-[#2A3042]/50'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleTreeReveal(node)}
                    className="flex min-w-0 flex-1 items-start gap-3 px-3 py-2.5 text-left"
                  >
                    <span className="relative mt-0.5 h-8 w-8 shrink-0 overflow-hidden rounded-md border border-[#2A3042] bg-[#111827]">
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
                        <span className="truncate font-medium text-[#E8ECF4]">
                          {node.name}
                        </span>
                        <span
                          className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium capitalize"
                          style={{
                            backgroundColor: `${categoryColor}30`,
                            color: categoryColor,
                          }}
                        >
                          {node.category.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-[#8B95A8]">
                        {yearStr ? (
                          <>
                            <span>{yearStr}</span>
                            <span className="text-[#5B6478]">·</span>
                          </>
                        ) : null}
                        <span>
                          {getTreeLayerShortLabel(treeLayerForSearchNode(node))}
                        </span>
                        <span className="text-[#5B6478]">·</span>
                        <span>{formatEra(node.era)}</span>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleFocusView(node);
                    }}
                    className="flex w-10 shrink-0 items-center justify-center border-l border-[#2A3042] text-[#8B95A8] transition-colors hover:bg-[#2A3042]/50 hover:text-[#3B82F6]"
                    title="Vue focalisée (détail + graphe)"
                    aria-label={`Vue focalisée : ${node.name}`}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M12 3v6" />
                      <path d="M12 15v6" />
                      <circle cx="12" cy="9" r="2" />
                      <circle cx="6" cy="15" r="2" />
                      <circle cx="18" cy="15" r="2" />
                      <path d="M12 11v2" />
                      <path d="M10.5 13.5 7 15" />
                      <path d="M13.5 13.5 17 15" />
                    </svg>
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
