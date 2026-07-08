import type { Request } from 'express'

import { getEnvNumber } from '@/utils/get'

export const isPublicCachePath = (req: Request): boolean => {
    const pathName = new URL(req.originalUrl, 'http://internal').pathname

    if (pathName.startsWith('/api/v1/player')) return false
    if (pathName.startsWith('/api/v1/user')) return false
    if (pathName.startsWith('/api/v1/auth')) return false
    if (pathName.startsWith('/api/v1/upload')) return false
    if (pathName.startsWith('/api/v1/movie/watch')) return false
    if (pathName === '/api/v1/meta/category') return false

    return [
        '/api/v1/home',
        '/api/v1/meta/menu',
        '/api/v1/movie',
        '/api/v1/performer',
        '/api/v1/studio',
        '/api/v1/search/category',
        '/api/v1/search/country',
        '/api/v1/interaction/comments',
        '/api/v1/interaction/ratings',
    ].some((prefix) => pathName.startsWith(prefix))
}

export const getPublicCacheTtl = (req: Request): number => {
    const pathName = new URL(req.originalUrl, 'http://internal').pathname

    if (pathName.startsWith('/api/v1/meta/menu')) {
        return getEnvNumber('CACHE_TTL_META_SECONDS', 3600)
    }

    if (pathName.startsWith('/api/v1/home')) {
        return getEnvNumber('CACHE_TTL_HOME_SECONDS', 60)
    }

    if (
        pathName.startsWith('/api/v1/interaction/comments') ||
        pathName.startsWith('/api/v1/interaction/ratings')
    ) {
        return getEnvNumber('CACHE_TTL_INTERACTION_SECONDS', 30)
    }

    if (
        pathName.startsWith('/api/v1/performer') ||
        pathName.startsWith('/api/v1/studio')
    ) {
        return getEnvNumber('CACHE_TTL_CATALOG_SECONDS', 600)
    }

    return getEnvNumber('CACHE_TTL_PUBLIC_SECONDS', 300)
}
