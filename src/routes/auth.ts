import express from 'express'

import AuthController from '@/controller/account/AuthController'
import AuthMiddleware from '@/middleware/auth'

const router = express.Router()

router.post('/login', AuthController.login)
router.post('/register', AuthController.register)
router.post('/refresh', AuthController.refresh)
router.get('/me', AuthMiddleware('user'), AuthController.me)
router.post('/logout', AuthMiddleware('user'), AuthController.logout)

export default router
