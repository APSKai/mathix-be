import express from 'express'

import AuthMiddleware from '@/middleware/auth'

const router = express.Router()

router.get('/', AuthMiddleware('admin'), () => {})

export default router
