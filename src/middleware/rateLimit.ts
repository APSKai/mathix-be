import type { NextFunction, Request, Response } from 'express'

import { getReadyRedisClient, getRedisKeyPrefix } from '@/configs/redis'

interface RedisRateLimitOptions {
    name: string
    max: number
    windowMs: number
    skip?: (req: Request) => boolean
}

export const rateLimit = (options: RedisRateLimitOptions) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        if (options.skip?.(req)) return next()

        const redis = await getReadyRedisClient()
        if (!redis) return next()

        const now = Date.now()
        const bucket = Math.floor(now / options.windowMs)
        const key = `${getRedisKeyPrefix()}:ratelimit:${options.name}:${getClientIp(req)}:${bucket}`
        const resetAt = (bucket + 1) * options.windowMs

        try {
            const count = await redis.incr(key)
            if (count === 1) {
                await redis.pexpire(key, options.windowMs)
            }

            const remaining = Math.max(0, options.max - count)
            res.setHeader('RateLimit-Limit', String(options.max))
            res.setHeader('RateLimit-Remaining', String(remaining))
            res.setHeader('RateLimit-Reset', String(Math.ceil(resetAt / 1000)))

            if (count > options.max) {
                res.setHeader(
                    'Retry-After',
                    String(Math.ceil((resetAt - now) / 1000))
                )
                return res.status(429).json({
                    status: false,
                    message: 'Too many requests',
                })
            }

            return next()
        } catch (error: any) {
            console.warn(`[rate-limit] failed: ${error.message}`)
            return next()
        }
    }
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
