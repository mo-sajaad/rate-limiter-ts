export interface TierConfig {
    windowMs: number;
    maxRequests: number;
}


export const RATE_LIMIT_TIERS: Record<string, TierConfig> = {
    free: {
        windowMs: 60 * 1000,
        maxRequests: 5,
    },
    pro: {
        windowMs: 60 * 1000,
        maxRequests: 50,
    },
    enterprise: {
        windowMs: 60 * 1000,
        maxRequests: 500,
    },
}


export const DEFAULT_TIER: TierConfig = RATE_LIMIT_TIERS.free