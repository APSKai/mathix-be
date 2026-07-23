import cookieParser from 'cookie-parser'
import cors from 'cors'
import dotenv from 'dotenv'
import type { Express, Request, Response } from 'express'
import express from 'express'
import { createServer } from 'http'

import connectDB from '@/configs/database'
import { getRateLimitPolicies } from '@/configs/rateLimit'
import { cache } from '@/middleware/cache'
import { createRateLimitMiddleware } from '@/middleware/rateLimit'
import routes from '@/routes'
import { getPublicCacheTtl, isPublicCachePath } from '@/utils/cache'
import { isAllowedOrigin } from '@/utils/cors'

if (process.env.NODE_ENV !== 'production') {
    dotenv.config()
}

const PORT: number = Number(process.env.PORT) || 4000
const HOST_NAME: string = process.env.URL || 'localhost'

const app: Express = express()

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
        exposedHeaders: [
            'RateLimit-Policy',
            'RateLimit-Limit',
            'RateLimit-Remaining',
            'RateLimit-Reset',
            'Retry-After',
        ],
        credentials: true,
    })
)

app.use('/api/v1', createRateLimitMiddleware(getRateLimitPolicies()))

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

const start = async () => {
    await connectDB()
    httpServer.listen(PORT, HOST_NAME as any, () => {
        console.info(`Server running on ${HOST_NAME}:${PORT}`)
    })
}

start().catch((error) => {
    console.error('Server startup failed', error)
    process.exit(1)
})
