import axios from 'axios'

import type { Request, Response } from 'express'

import admin from '@/configs/firebase'
import type { AuthRequest } from '@/middleware/auth'
import {
    createUserProfile,
    getUserProfile,
    toUserDto,
} from '@/services/firebaseUserService'

const refreshCookieName = 'mathix_refresh_token'

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: (process.env.COOKIE_SAME_SITE || 'lax') as
        | 'lax'
        | 'strict'
        | 'none',
    maxAge: 60 * 24 * 60 * 60 * 1000,
}

class AuthController {
    static register = async (req: Request, res: Response) => {
        let createdUid = ''
        try {
            const username = String(req.body.username || '')
                .trim()
                .toLowerCase()
            const fullName = String(req.body.fullName || '').trim()
            const email = String(req.body.email || '')
                .trim()
                .toLowerCase()
            const password = String(req.body.password || '')

            if (!username || !fullName || !email || !password) {
                return res
                    .status(400)
                    .json({
                        status: false,
                        message:
                            'Tên đăng nhập, họ tên, email và mật khẩu là bắt buộc',
                    })
            }

            const firebaseUser = await admin
                .auth()
                .createUser({ email, password, displayName: fullName })
            createdUid = firebaseUser.uid
            const profile = await createUserProfile(
                firebaseUser,
                username,
                fullName
            )

            return res
                .status(201)
                .json({
                    status: true,
                    message: 'Đăng ký tài khoản thành công',
                    user: toUserDto(profile, firebaseUser),
                })
        } catch (error: any) {
            if (createdUid) {
                await admin
                    .auth()
                    .deleteUser(createdUid)
                    .catch(() => undefined)
            }
            const duplicated =
                error.code === 'auth/email-already-exists' ||
                error.message === 'Tên đăng nhập đã tồn tại'
            const message = duplicated
                ? 'Tên đăng nhập hoặc email đã tồn tại'
                : 'Không thể đăng ký tài khoản'
            return res
                .status(duplicated ? 409 : 400)
                .json({ status: false, message })
        }
    }

    static login = async (req: Request, res: Response) => {
        try {
            const email = String(req.body.email || '')
                .trim()
                .toLowerCase()
            const password = String(req.body.password || '')
            if (!email || !password) {
                return res
                    .status(400)
                    .json({
                        status: false,
                        message: 'Email và mật khẩu là bắt buộc',
                    })
            }

            const response = await axios.post(
                `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`,
                { email, password, returnSecureToken: true }
            )
            const [firebaseUser, profile] = await Promise.all([
                admin.auth().getUser(response.data.localId),
                getUserProfile(response.data.localId),
            ])
            if (!profile) {
                return res
                    .status(404)
                    .json({
                        status: false,
                        message: 'Không tìm thấy hồ sơ người dùng',
                    })
            }

            res.cookie(
                refreshCookieName,
                response.data.refreshToken,
                cookieOptions
            )
            return res.status(200).json({
                status: true,
                message: 'Đăng nhập thành công',
                accessToken: response.data.idToken,
                expiresIn: Number(response.data.expiresIn),
                user: toUserDto(profile, firebaseUser),
            })
        } catch (error: any) {
            return res.status(401).json({
                status: false,
                message: 'Email hoặc mật khẩu không đúng',
            })
        }
    }

    static refresh = async (req: Request, res: Response) => {
        try {
            const refreshToken = req.cookies?.[refreshCookieName]
            if (!refreshToken)
                return res
                    .status(401)
                    .json({
                        status: false,
                        message: 'Phiên đăng nhập đã hết hạn',
                    })

            const response = await axios.post(
                `https://securetoken.googleapis.com/v1/token?key=${process.env.FIREBASE_API_KEY}`,
                new URLSearchParams({
                    grant_type: 'refresh_token',
                    refresh_token: refreshToken,
                }),
                {
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                }
            )
            return res.json({
                status: true,
                accessToken: response.data.id_token,
                expiresIn: Number(response.data.expires_in),
            })
        } catch {
            res.clearCookie(refreshCookieName, cookieOptions)
            return res
                .status(401)
                .json({
                    status: false,
                    message: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn',
                })
        }
    }

    static me = async (req: AuthRequest, res: Response) => {
        return res.json({
            status: true,
            user: toUserDto(req.user.profile, {
                email: req.user.email,
                emailVerified: req.user.email_verified,
            }),
        })
    }

    static logout = async (req: AuthRequest, res: Response) => {
        try {
            await admin.auth().revokeRefreshTokens(req.user.uid)
        } catch {
            // The local cookie is still cleared if Firebase revocation is unavailable.
        } finally {
            res.clearCookie(refreshCookieName, cookieOptions)
        }
        return res.json({ status: true, message: 'Đăng xuất thành công' })
    }
}

export default AuthController
