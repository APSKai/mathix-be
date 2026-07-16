import { NextFunction, Request, Response } from 'express'
import type { DecodedIdToken } from 'firebase-admin/auth'

import admin from '@/configs/firebase'
import { getUserProfile } from '@/services/firebaseUserService'
import type { FirebaseUserProfile } from '@/services/firebaseUserService'

export interface AuthenticatedUser extends DecodedIdToken {
    profile: FirebaseUserProfile
}

export interface AuthRequest extends Request {
    user: AuthenticatedUser
}

export default (role: string = 'user') =>
    async (req: AuthRequest, res: Response, next: NextFunction) => {
        try {
            const token = req.headers.authorization?.replace('Bearer ', '')

            if (!token) {
                return res.status(401).json({
                    status: false,
                    message: 'Vui lòng đăng nhập để tiếp tục',
                })
            }

            const decoded = await admin.auth().verifyIdToken(token, true)

            const profile = await getUserProfile(decoded.uid)

            if (!profile) {
                return res.status(401).json({
                    message: 'Không tìm thấy hồ sơ người dùng',
                })
            }

            if (role === 'admin' && profile.role !== 'admin') {
                return res.status(403).json({
                    message: 'Bạn không có quyền truy cập chức năng này',
                })
            }

            req.user = { ...decoded, profile }

            next()
        } catch (error: any) {
            return res.status(401).json({
                message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn',
            })
        }
    }
