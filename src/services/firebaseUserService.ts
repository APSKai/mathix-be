import crypto from 'crypto'
import type { UserRecord } from 'firebase-admin/auth'
import type { DocumentData } from 'firebase-admin/firestore'

import admin from '@/configs/firebase'
import type { UserRole } from '@/types/user'

export interface FirebaseUserProfile {
    uid: string
    username: string
    fullName: string
    avatar: string
    role: UserRole
    createdAt: Date
    updatedAt: Date
}

export interface FirebaseAuthSummary {
    email?: string | null
    emailVerified?: boolean
}

const usersCollection = 'users'
const usernamesCollection = 'usernames'

const defaultAvatar = (fullName: string) =>
    `https://ui-avatars.com/api/?name=${encodeURIComponent(fullName)}&background=random&color=fff&size=128`

const usernameKey = (username: string) =>
    crypto.createHash('sha256').update(username.toLowerCase()).digest('hex')

const toDate = (value: unknown, fallback: Date) => {
    if (value instanceof Date) return value
    if (
        value &&
        typeof (value as { toDate?: () => Date }).toDate === 'function'
    ) {
        return (value as { toDate: () => Date }).toDate()
    }
    if (typeof value === 'string' || typeof value === 'number') {
        const date = new Date(value)
        if (!Number.isNaN(date.getTime())) return date
    }
    return fallback
}

const profileFromData = (
    uid: string,
    data: DocumentData
): FirebaseUserProfile => {
    const now = new Date()
    return {
        uid,
        username: String(data.username || ''),
        fullName: String(data.fullName || data.username || ''),
        avatar: String(
            data.avatar ||
                defaultAvatar(String(data.fullName || data.username || 'User'))
        ),
        role: data.role === 'admin' ? 'admin' : 'user',
        createdAt: toDate(data.createdAt, now),
        updatedAt: toDate(data.updatedAt, now),
    }
}

export const toUserDto = (
    profile: FirebaseUserProfile,
    authUser?: FirebaseAuthSummary
) => ({
    uid: profile.uid,
    username: profile.username,
    fullName: profile.fullName,
    email: authUser?.email || '',
    role: profile.role,
    verify: Boolean(authUser?.emailVerified),
    avatar: profile.avatar,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
})

export const getUserProfile = async (
    uid: string
): Promise<FirebaseUserProfile | null> => {
    const snapshot = await admin
        .firestore()
        .collection(usersCollection)
        .doc(uid)
        .get()
    if (!snapshot.exists) return null
    return profileFromData(uid, snapshot.data() || {})
}

export const getUserProfiles = async (uids: string[]) => {
    const uniqueUids = [...new Set(uids.filter(Boolean))]
    if (!uniqueUids.length) return new Map<string, FirebaseUserProfile>()

    const snapshots = await admin
        .firestore()
        .getAll(
            ...uniqueUids.map((uid) =>
                admin.firestore().collection(usersCollection).doc(uid)
            )
        )
    const profiles = new Map<string, FirebaseUserProfile>()
    for (const snapshot of snapshots) {
        if (snapshot.exists)
            profiles.set(
                snapshot.id,
                profileFromData(snapshot.id, snapshot.data() || {})
            )
    }
    return profiles
}

export const createUserProfile = async (
    authUser: UserRecord,
    username: string,
    fullName: string
) => {
    const normalizedUsername = username.trim().toLowerCase()
    const normalizedFullName = fullName.trim()
    const profileRef = admin
        .firestore()
        .collection(usersCollection)
        .doc(authUser.uid)
    const usernameRef = admin
        .firestore()
        .collection(usernamesCollection)
        .doc(usernameKey(normalizedUsername))
    const now = new Date()

    await admin.firestore().runTransaction(async (transaction) => {
        const usernameSnapshot = await transaction.get(usernameRef)
        if (
            usernameSnapshot.exists &&
            usernameSnapshot.data()?.uid !== authUser.uid
        ) {
            throw new Error('Tên đăng nhập đã tồn tại')
        }

        const existingProfiles = await transaction.get(
            admin
                .firestore()
                .collection(usersCollection)
                .where('username', '==', normalizedUsername)
                .limit(1)
        )
        if (
            existingProfiles.docs.some(
                (snapshot) => snapshot.id !== authUser.uid
            )
        ) {
            throw new Error('Tên đăng nhập đã tồn tại')
        }

        transaction.set(profileRef, {
            uid: authUser.uid,
            username: normalizedUsername,
            usernameNormalized: normalizedUsername,
            fullName: normalizedFullName,
            avatar: defaultAvatar(normalizedFullName),
            role: 'user',
            createdAt: now,
            updatedAt: now,
        })
        transaction.set(usernameRef, {
            uid: authUser.uid,
            username: normalizedUsername,
            createdAt: now,
        })
    })

    return profileFromData(authUser.uid, {
        uid: authUser.uid,
        username: normalizedUsername,
        fullName: normalizedFullName,
        avatar: defaultAvatar(normalizedFullName),
        role: 'user',
        createdAt: now,
        updatedAt: now,
    })
}

export const updateUserProfile = async (uid: string, fullName: string) => {
    const profileRef = admin.firestore().collection(usersCollection).doc(uid)
    const snapshot = await profileRef.get()
    if (!snapshot.exists) return null

    const normalizedFullName = fullName.trim()
    await profileRef.set(
        {
            fullName: normalizedFullName,
            avatar: defaultAvatar(normalizedFullName),
            updatedAt: new Date(),
        },
        { merge: true }
    )

    const updatedSnapshot = await profileRef.get()
    return profileFromData(uid, updatedSnapshot.data() || {})
}
