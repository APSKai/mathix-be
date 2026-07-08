import express from 'express'

import UserController from '@/controller/account/UserController'
import AuthMiddleware from '@/middleware/auth'

const router = express.Router()

router.patch('/:userId', AuthMiddleware('user'), UserController.update)

export default router
