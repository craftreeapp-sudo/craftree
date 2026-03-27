'use client';

import { useState, useCallback, type MouseEvent } from 'react';
import type { NodeProps } from '@xyflow/react';
import { useFocusLinkEditStore } from '@/stores/focus-link-edit-store';
import { FOCUS_ADD_BTN_PX } from './focus-overlay-nodes';

export type AddButtonData = {
  variant: 'inputs' | 'outputs';
};

/** Nœud React Flow : taille alignée sur {@link FOCUS_ADD_BTN_PX}. */
export function AddConnectionButton({ data }: NodeProps) {
  const d = data as AddButtonData;
  const [hover, setHover] = useState(false);
  const openSearch = useFocusLinkEditStore((s) => s.openSearch);

  const onBtnClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      openSearch(d.variant);
    },
    [d.variant, openSearch]
  );

  const bt = FOCUS_ADD_BTN_PX;

  return (
    <div
      className="nodrag nopan flex h-full w-full items-center justify-center"
      style={{ pointerEvents: 'auto', minWidth: bt, minHeight: bt }}
    >
      <button
        type="button"
        className="flex shrink-0 cursor-pointer items-center justify-center rounded-full border-0 font-semibold leading-none shadow-md transition-[background-color,color,transform] duration-200 ease-out"
        style={{
          width: bt,
          height: bt,
          fontSize: Math.round(bt * 0.55),
          backgroundColor: hover ? 'var(--accent)' : '#FFFFFF',
          color: hover ? '#FFFFFF' : 'var(--page)',
          transform: hover ? 'scale(1.05)' : 'scale(1)',
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onBtnClick}
        onPointerEnter={() => setHover(true)}
        onPointerLeave={() => setHover(false)}
        aria-label={
          d.variant === 'inputs'
            ? 'Ajouter un intrant (obtenu grâce à)'
            : 'Ajouter un produit (a conduit à)'
        }
      >
        +
      </button>
    </div>
  );
}
