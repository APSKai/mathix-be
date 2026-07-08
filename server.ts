import cookieParser from 'cookie-parser'
import cors from 'cors'
import dotenv from 'dotenv'
import type { Express, Request, Response } from 'express'
import express from 'express'
import { createServer } from 'http'

import { cache } from '@/middleware/cache'
import { rateLimit } from '@/middleware/rateLimit'
import routes from '@/routes'
import { getPublicCacheTtl, isPublicCachePath } from '@/utils/cache'
import { isAllowedOrigin, isApiOptionsRequest } from '@/utils/cors'
import { getEnvNumber } from '@/utils/get'

if (process.env.NODE_ENV !== 'production') {
    dotenv.config()
}

const PORT: number = Number(process.env.PORT) || 4000
const HOST_NAME: string = process.env.URL || 'localhost'

const app: Express = express()

const formatRoutePath = (routePath: unknown): string => {
    if (typeof routePath === 'string') {
        return routePath
    }

    if (routePath instanceof RegExp) {
        return routePath.toString()
    }

    if (Array.isArray(routePath)) {
        return routePath.map(formatRoutePath).join('|')
    }

    return 'unknown'
}

app.use(
    cors({
        origin: function (origin, callback) {
            if (isAllowedOrigin(origin)) {
                callback(null, true)
            } else {
                callback(new Error('Not allowed by CORS'))
            }
        },
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-Playback-Session',
            'Accept',
            'x-csrf-token',
            'X-XSRF-TOKEN',
            'Origin',
            'X-Requested-With',
            'X-Signature',
            'Range',
        ],
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        credentials: true,
    })
)

app.use(
    '/api/v1',
    rateLimit({
        name: 'api',
        windowMs: getEnvNumber('RATE_LIMIT_API_WINDOW_MS', 60000),
        max: getEnvNumber('RATE_LIMIT_API_MAX', 600),
        skip: isApiOptionsRequest,
    })
)
app.use(
    '/api/v1/auth',
    rateLimit({
        name: 'auth',
        windowMs: getEnvNumber('RATE_LIMIT_AUTH_WINDOW_MS', 15 * 60 * 1000),
        max: getEnvNumber('RATE_LIMIT_AUTH_MAX', 30),
        skip: isApiOptionsRequest,
    })
)

app.use(
    '/api/v1',
    rateLimit({
        name: 'write',
        windowMs: getEnvNumber('RATE_LIMIT_WRITE_WINDOW_MS', 60000),
        max: getEnvNumber('RATE_LIMIT_WRITE_MAX', 120),
        skip: (req) =>
            isApiOptionsRequest(req) ||
            req.method === 'GET' ||
            req.method === 'HEAD',
    })
)

const httpServer = createServer(app)

app.use(cookieParser())
app.use(
    express.static('public', {
        setHeaders: (res, filePath) => {
            if (filePath.endsWith('.vtt')) {
                res.setHeader('Content-Type', 'text/vtt; charset=utf-8')
            } else if (filePath.endsWith('.m3u8')) {
                res.setHeader('Content-Type', 'application/vnd.apple.mpegurl')
                res.setHeader('Cache-Control', 'no-store')
            }
        },
    })
)
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' })
})

app.use(
    '/api/v1',
    cache({
        namespace: 'public',
        ttlSeconds: getPublicCacheTtl,
        shouldCache: isPublicCachePath,
    })
)
app.use('/api/v1', routes)

httpServer.listen(PORT, HOST_NAME as any, () => {
    console.info(`Server running on ${HOST_NAME}:${PORT}`)
})
