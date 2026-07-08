export type UserRole = 'admin' | 'user'

export interface IUser {
    uid: string
    username: string
    fullName: string
    email: string
    role: UserRole
    verify: boolean
    avatar: string
    createdAt: Date
    updatedAt: Date
}
