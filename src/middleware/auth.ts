import { NextFunction, Request, Response } from 'express'

import admin from '@/configs/firebase'

export interface AuthRequest extends Request {
    user?: any
}

export default (role: string = 'user') =>
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const token = req.headers.authorization?.replace('Bearer ', '')

            if (!token) {
                return res.status(401).json({
                    status: false,
                    message: 'Token is required',
                })
            }

            const decoded = await admin.auth().verifyIdToken(token, true)

            if (role === 'admin' && decoded.role !== 'admin') {
                return res.status(403).json({
                    message: 'You are not authorized to access this API',
                })
            }

            req.user = decoded

            next()
        } catch (error: any) {
            return res.status(401).json({
                message: error.message || 'You are not authenticated',
            })
        }
    }
