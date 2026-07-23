import type { NextFunction, Request, Response } from 'express'
import type Redis from 'ioredis'

import {
    type RateLimitMethod,
    type RateLimitPolicy,
    validateRateLimitPolicies,
} from '@/configs/rateLimit'
import { getReadyRedisClient, getRedisKeyPrefix } from '@/configs/redis'

interface RateLimitCounter {
    count: number
    remaining: number
    resetAt: number
}

interface AppliedRateLimit {
    policy: RateLimitPolicy
    counter: RateLimitCounter
}

const incrementScript = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
    redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return count
`

export const createRateLimitMiddleware = (
    policies: readonly RateLimitPolicy[]
) => {
    validateRateLimitPolicies(policies)

    return async (req: Request, res: Response, next: NextFunction) => {
        const matchingPolicies = getMatchingRateLimitPolicies(policies, req)
        if (matchingPolicies.length === 0) return next()

        const redis = await getReadyRedisClient()
        if (!redis) return next()

        const now = Date.now()
        const clientIp = getClientIp(req)
        const appliedPolicies: AppliedRateLimit[] = []

        try {
            for (const policy of matchingPolicies) {
                const counter = await incrementRateLimit(
                    redis,
                    policy,
                    clientIp,
                    now
                )
                appliedPolicies.push({ policy, counter })

                if (counter.count > policy.max) {
                    setRateLimitHeaders(res, policy, counter, now)
                    return res.status(429).json({
                        status: false,
                        message: 'Bạn thao tác quá nhanh, vui lòng thử lại sau',
                    })
                }
            }

            const governingPolicy = getGoverningRateLimit(appliedPolicies)
            if (governingPolicy) {
                setRateLimitHeaders(
                    res,
                    governingPolicy.policy,
                    governingPolicy.counter,
                    now
                )
            }

            return next()
        } catch (error: unknown) {
            const message =
                error instanceof Error ? error.message : String(error)
            console.warn(`[rate-limit] failed: ${message}`)
            return next()
        }
    }
}

export const rateLimit = createRateLimitMiddleware

export const getMatchingRateLimitPolicies = (
    policies: readonly RateLimitPolicy[],
    req: Request
): RateLimitPolicy[] => {
    if (req.method === 'OPTIONS') return []

    return policies.filter((policy) => matchesRateLimitPolicy(policy, req))
}

export const matchesRateLimitPolicy = (
    policy: RateLimitPolicy,
    req: Request
): boolean => {
    if (req.method === 'OPTIONS') return false

    if (
        policy.methods &&
        !policy.methods.includes(req.method as RateLimitMethod)
    ) {
        return false
    }

    const pathname = getPathname(req)
    const policyPath = removeTrailingSlash(policy.path)

    if (policy.pathMatch === 'exact') return pathname === policyPath

    return pathname === policyPath || pathname.startsWith(`${policyPath}/`)
}

const incrementRateLimit = async (
    redis: Redis,
    policy: RateLimitPolicy,
    clientIp: string,
    now: number
): Promise<RateLimitCounter> => {
    const bucket = Math.floor(now / policy.windowMs)
    const key = `${getRedisKeyPrefix()}:ratelimit:${policy.name}:${clientIp}:${bucket}`
    const resetAt = (bucket + 1) * policy.windowMs
    const rawCount = await redis.eval(
        incrementScript,
        1,
        key,
        String(policy.windowMs)
    )
    const count = Number(rawCount)

    return {
        count,
        remaining: Math.max(0, policy.max - count),
        resetAt,
    }
}

const getGoverningRateLimit = (
    appliedPolicies: readonly AppliedRateLimit[]
): AppliedRateLimit | undefined => {
    return appliedPolicies.reduce<AppliedRateLimit | undefined>(
        (governingPolicy, appliedPolicy) => {
            if (!governingPolicy) return appliedPolicy

            const governingRatio =
                governingPolicy.counter.remaining / governingPolicy.policy.max
            const appliedRatio =
                appliedPolicy.counter.remaining / appliedPolicy.policy.max

            if (appliedRatio < governingRatio) return appliedPolicy
            if (
                appliedRatio === governingRatio &&
                appliedPolicy.counter.resetAt < governingPolicy.counter.resetAt
            ) {
                return appliedPolicy
            }

            return governingPolicy
        },
        undefined
    )
}

const setRateLimitHeaders = (
    res: Response,
    policy: RateLimitPolicy,
    counter: RateLimitCounter,
    now: number
): void => {
    res.setHeader('RateLimit-Policy', policy.name)
    res.setHeader('RateLimit-Limit', String(policy.max))
    res.setHeader('RateLimit-Remaining', String(counter.remaining))
    res.setHeader('RateLimit-Reset', String(Math.ceil(counter.resetAt / 1000)))

    if (counter.count > policy.max) {
        res.setHeader(
            'Retry-After',
            String(Math.max(1, Math.ceil((counter.resetAt - now) / 1000)))
        )
    } else {
        res.removeHeader('Retry-After')
    }
}

const getPathname = (req: Request): string => {
    const url = req.originalUrl || req.url

    try {
        return new URL(url, 'http://internal').pathname
    } catch {
        return url.split('?')[0] || '/'
    }
}

const removeTrailingSlash = (path: string): string => {
    if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1)
    return path
}

const getClientIp = (req: Request): string => {
    const headers = [
        req.headers['cf-connecting-ip'],
        req.headers['x-real-ip'],
        req.headers['x-forwarded-for'],
    ]

    for (const value of headers) {
        const header = Array.isArray(value) ? value[0] : value
        if (typeof header === 'string' && header.trim()) {
            return header.split(',')[0].trim()
        }
    }

    return req.socket.remoteAddress || 'unknown'
}
