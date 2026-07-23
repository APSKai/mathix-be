import { getEnvNumber } from '@/utils/get'

export type RateLimitPathMatch = 'exact' | 'prefix'

export type RateLimitMethod =
    | 'GET'
    | 'HEAD'
    | 'POST'
    | 'PUT'
    | 'PATCH'
    | 'DELETE'
    | 'OPTIONS'

export interface RateLimitPolicy {
    name: string
    path: string
    pathMatch: RateLimitPathMatch
    methods?: readonly RateLimitMethod[]
    windowMs: number
    max: number
}

const writeMethods: readonly RateLimitMethod[] = [
    'POST',
    'PUT',
    'PATCH',
    'DELETE',
]

/**
 * Build the rate-limit registry after dotenv has loaded the environment.
 * Keep this as a function instead of a module-level constant so local .env
 * values are read at application startup.
 */
export const getRateLimitPolicies = (): readonly RateLimitPolicy[] => {
    const policies: readonly RateLimitPolicy[] = [
        {
            name: 'api',
            path: '/api/v1',
            pathMatch: 'prefix',
            windowMs: getEnvNumber('RATE_LIMIT_API_WINDOW_MS', 60000),
            max: getEnvNumber('RATE_LIMIT_API_MAX', 600),
        },
        {
            name: 'auth',
            path: '/api/v1/auth',
            pathMatch: 'prefix',
            windowMs: getEnvNumber('RATE_LIMIT_AUTH_WINDOW_MS', 15 * 60 * 1000),
            max: getEnvNumber('RATE_LIMIT_AUTH_MAX', 30),
        },
        {
            name: 'write',
            path: '/api/v1',
            pathMatch: 'prefix',
            methods: writeMethods,
            windowMs: getEnvNumber('RATE_LIMIT_WRITE_WINDOW_MS', 60000),
            max: getEnvNumber('RATE_LIMIT_WRITE_MAX', 120),
        },
    ]

    validateRateLimitPolicies(policies)
    return policies
}

export const validateRateLimitPolicies = (
    policies: readonly RateLimitPolicy[]
): void => {
    const names = new Set<string>()

    for (const policy of policies) {
        if (!policy.name.trim()) {
            throw new Error('[rate-limit] policy name is required')
        }

        if (names.has(policy.name)) {
            throw new Error(
                `[rate-limit] duplicate policy name: ${policy.name}`
            )
        }
        names.add(policy.name)

        if (!policy.path.startsWith('/')) {
            throw new Error(
                `[rate-limit] policy path must start with /: ${policy.name}`
            )
        }

        if (
            !Number.isFinite(policy.max) ||
            !Number.isFinite(policy.windowMs) ||
            policy.max <= 0 ||
            policy.windowMs <= 0
        ) {
            throw new Error(
                `[rate-limit] max and windowMs must be positive: ${policy.name}`
            )
        }

        if (policy.methods?.length === 0) {
            throw new Error(
                `[rate-limit] methods cannot be empty: ${policy.name}`
            )
        }
    }
}
