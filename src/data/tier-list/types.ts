export interface TierDef {
  id: string;
  label: string;
  emoji?: string;
  color?: string;
}

export interface DetailField {
  key: string;
  label: string;
}

export interface TierItem {
  id: string;
  name: string;
  emoji?: string;
  image?: string;
  accent?: string;
  description: string;
  link?: string;
  tags?: string[];
  defaultTier: string;
  meta?: Record<string, string | number>;
}

export type PackKind = 'official' | 'template' | 'user';
export type PackPlugin = 'furnace-cost';

export interface TierPack {
  id: string;
  title: string;
  subtitle: string;
  kind: PackKind;
  prompt?: string;
  plugins?: PackPlugin[];
  tiers: TierDef[];
  items: TierItem[];
  detailFields?: DetailField[];
  sourceId?: string;
  updatedAt?: string;
}

export const UNRANKED_TIER = 'unranked';

export const standardTiers: TierDef[] = [
  { id: 'S', label: 'S Tier', emoji: '🔥', color: '#f59e0b' },
  { id: 'A', label: 'A Tier', emoji: '⭐', color: '#38bdf8' },
  { id: 'B', label: 'B Tier', emoji: '✔', color: '#34d399' },
  { id: 'C', label: 'C Tier', emoji: '•', color: '#a78bfa' },
  { id: 'D', label: 'D Tier', emoji: '↓', color: '#94a3b8' },
];

export function clonePack(pack: TierPack, overrides: Partial<TierPack> = {}): TierPack {
  return {
    ...pack,
    ...overrides,
    plugins: [...(overrides.plugins ?? pack.plugins ?? [])],
    tiers: (overrides.tiers ?? pack.tiers).map((tier) => ({ ...tier })),
    items: (overrides.items ?? pack.items).map((item) => ({
      ...item,
      tags: [...(item.tags ?? [])],
      meta: item.meta ? { ...item.meta } : undefined,
    })),
    detailFields: (overrides.detailFields ?? pack.detailFields)?.map((field) => ({ ...field })),
  };
}
