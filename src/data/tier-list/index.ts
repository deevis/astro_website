import { civicDecayPack } from './civic-decay';
import { economicSystemsPack } from './economic-systems';
import { furnacesPack } from './furnaces';
import type { TierPack } from './types';

export * from './types';

export const officialPacks: TierPack[] = [furnacesPack, economicSystemsPack];
export const templatePacks: TierPack[] = [civicDecayPack];
export const shippedPacks: TierPack[] = [...officialPacks, ...templatePacks];

export function findShippedPack(id: string): TierPack | undefined {
  return shippedPacks.find((pack) => pack.id === id);
}
