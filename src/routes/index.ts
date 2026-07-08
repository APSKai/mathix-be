import express from 'express'

import authRoutes from '@/routes/auth'
import uploadRoutes from '@/routes/upload'
import userRoutes from '@/routes/user'

const router = express.Router()

router.use('/auth', authRoutes)
router.use('/user', userRoutes)
router.use('/upload', uploadRoutes)

export default router
