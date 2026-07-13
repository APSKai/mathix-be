import axios from 'axios'

import { Request, Response } from 'express'

import admin from '@/configs/firebase'
import { AuthRequest } from '@/middleware/auth'
import { IUser } from '@/types/user'
import { firestoreTimestampToISOString } from '@/utils/format'

class AuthController {
    static register = async (req: Request, res: Response) => {
        try {
            const { username, fullName, email, password } = req.body

            if (!username || !fullName || !email || !password) {
                return res.status(400).json({
                    status: false,
                    message:
                        'Username, fullName, email and password are required',
                })
            }

            const usernameSnapshot = await admin
                .firestore()
                .collection('users')
                .where('username', '==', username)
                .limit(1)
                .get()

            if (!usernameSnapshot.empty) {
                return res.status(400).json({
                    status: false,
                    message: 'Username already exists',
                })
            }

            const firebaseUser = await admin.auth().createUser({
                email,
                password,
                displayName: fullName,
            })

            const now = new Date()

            const user: IUser = {
                uid: firebaseUser.uid,
                username,
                fullName,
                email,
                role: 'user',
                verify: firebaseUser.emailVerified,
                avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random&color=fff&size=128`,
                createdAt: now,
                updatedAt: now,
            }

            await admin
                .firestore()
                .collection('users')
                .doc(firebaseUser.uid)
                .set(user)

            return res.status(201).json({
                status: true,
                message: 'Register successfully',
            })
        } catch (error: any) {
            console.log(error)
            return res.status(400).json({
                status: false,
                message: error.message,
            })
        }
    }

    static login = async (req: Request, res: Response) => {
        try {
            const { email, password } = req.body

            if (!email || !password) {
                return res.status(400).json({
                    status: false,
                    message: 'Email and password are required',
                })
            }

            const response = await axios.post(
                `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`,
                {
                    email,
                    password,
                    returnSecureToken: true,
                }
            )

            const uid = response.data.localId

            const userDoc = await admin
                .firestore()
                .collection('users')
                .doc(uid)
                .get()

            if (!userDoc.exists) {
                return res.status(404).json({
                    status: false,
                    message: 'User profile not found',
                })
            }

            return res.status(200).json({
                status: true,
                message: 'Login successfully',
                accessToken: response.data.idToken,
                refreshToken: response.data.refreshToken,
                expiresIn: response.data.expiresIn,
            })
        } catch (error: any) {
            return res.status(401).json({
                status: false,
                message:
                    error.response?.data?.error?.message ||
                    'Invalid email or password',
            })
        }
    }

    static me = async (req: AuthRequest, res: Response) => {
        try {
            const userDoc = await admin
                .firestore()
                .collection('users')
                .doc(req.user.uid)
                .get()

            if (!userDoc.exists) {
                return res.status(404).json({
                    status: false,
                    message: 'User not found',
                })
            }

            return res.json({
                status: true,
                user: {
                    uid: userDoc.data()?.uid,
                    username: userDoc.data()?.username,
                    fullName: userDoc.data()?.fullName,
                    email: userDoc.data()?.email,
                    role: userDoc.data()?.role,
                    verify: userDoc.data()?.verify,
                    avatar: userDoc.data()?.avatar,
                    createdAt: firestoreTimestampToISOString(
                        userDoc.data()?.createdAt
                    ),
                    updatedAt: firestoreTimestampToISOString(
                        userDoc.data()?.updatedAt
                    ),
                },
            })
        } catch (error: any) {
            return res.status(500).json({
                status: false,
                message:
                    error.response?.data?.error?.message ||
                    'Internal Server Error',
            })
        }
    }

    static logout = async (req: AuthRequest, res: Response) => {
        try {
            await admin.auth().revokeRefreshTokens(req.user.uid)

            return res.json({
                status: true,
                message: 'Logout successfully',
            })
        } catch (error: any) {
            return res.status(500).json({
                status: false,
                message:
                    error.response?.data?.error?.message ||
                    'Internal Server Error',
            })
        }
    }
}

export default AuthController
