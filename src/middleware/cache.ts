import crypto from 'crypto'
import type { NextFunction, Request, Response } from 'express'

import { getReadyRedisClient, getRedisKeyPrefix } from '@/configs/redis'

interface CachedResponse {
    body: string
    contentType?: string
    statusCode: number
}

interface RedisCacheOptions {
    namespace: string
    ttlSeconds: number | ((req: Request) => number)
    shouldCache?: (req: Request) => boolean
}

export const cache = (options: RedisCacheOptions) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        if (!isCacheableRequest(req, options)) return next()

        const ttlSeconds = getTtlSeconds(req, options)
        if (ttlSeconds <= 0) return next()

        const redis = await getReadyRedisClient()
        if (!redis) return next()

        const cacheKey = buildCacheKey(options.namespace, req)

        try {
            const cached = await redis.get(cacheKey)
            if (cached) {
                const payload = JSON.parse(cached) as CachedResponse
                res.setHeader('X-Cache', 'HIT')
                res.setHeader('Cache-Control', `public, max-age=${ttlSeconds}`)
                if (payload.contentType) {
                    res.setHeader('Content-Type', payload.contentType)
                }
                return res.status(payload.statusCode).send(payload.body)
            }
        } catch (error: any) {
            console.warn(`[cache] read failed: ${error.message}`)
            return next()
        }

        const originalSend = res.send.bind(res)
        res.setHeader('X-Cache', 'MISS')

        res.send = ((body?: any) => {
            const contentType = String(res.getHeader('Content-Type') || '')
            const cacheControl = String(res.getHeader('Cache-Control') || '')
            const canStore =
                res.statusCode === 200 &&
                isJsonContent(contentType) &&
                !/no-store|private/i.test(cacheControl) &&
                body !== undefined

            if (canStore) {
                const payload: CachedResponse = {
                    body: Buffer.isBuffer(body) ? body.toString('utf8') : String(body),
                    contentType,
                    statusCode: res.statusCode,
                }

                void redis
                    .set(cacheKey, JSON.stringify(payload), 'EX', ttlSeconds)
                    .catch((error: any) =>
                        console.warn(`[cache] write failed: ${error.message}`)
                    )

                res.setHeader(
                    'Cache-Control',
                    `public, max-age=${ttlSeconds}`
                )
            }

            return originalSend(body)
        }) as Response['send']

        return next()
    }
}

const isCacheableRequest = (
    req: Request,
    options: RedisCacheOptions
): boolean => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return false
    if (req.headers.authorization) return false
    if (req.headers['cache-control']?.includes('no-cache')) return false
    if (req.query._nocache !== undefined) return false
    if (options.shouldCache && !options.shouldCache(req)) return false
    return true
}

const getTtlSeconds = (req: Request, options: RedisCacheOptions): number => {
    return typeof options.ttlSeconds === 'function'
        ? options.ttlSeconds(req)
        : options.ttlSeconds
}

const buildCacheKey = (namespace: string, req: Request): string => {
    const hash = crypto
        .createHash('sha1')
        .update(`${req.method}:${req.originalUrl}`)
        .digest('hex')
    return `${getRedisKeyPrefix()}:cache:${namespace}:${hash}`
}

const isJsonContent = (contentType: string): boolean => {
    return (
        contentType.includes('application/json') ||
        contentType.includes('+json') ||
        contentType === ''
    )
}
