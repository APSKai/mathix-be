import type { Request } from 'express'

import { whitelist } from '@/configs/cors'

export const isApiOptionsRequest = (req: Request): boolean =>
    req.method === 'OPTIONS'

export const isAllowedOrigin = (origin?: string): boolean => {
    if (!origin) return true
    if (whitelist.includes(origin)) return true

    const normalizedApiPublicUrl = process.env.API_PUBLIC_URL
    if (normalizedApiPublicUrl) {
        try {
            return origin === new URL(normalizedApiPublicUrl).origin
        } catch {
            return false
        }
    }

    return false
}
