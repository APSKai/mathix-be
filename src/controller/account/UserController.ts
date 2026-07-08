import { Request, Response } from 'express'

class UserController {
    static update = async (req: Request, res: Response) => {
        try {
            const currentUser = (req as any).user
            const { userId } = req.params
            if (!currentUser) {
                return res.status(404).json({
                    status: false,
                    message: 'User does not exist',
                })
            }

            const fullName = String(req.body.fullName || '').trim()

            if (!fullName) {
                return res.status(400).json({
                    status: false,
                    message: 'Display name is required',
                })
            }

            const updatedUser = {}

            return res.status(200).json({
                status: true,
                data: updatedUser,
                message: 'Updated profile successfully',
            })
        } catch (e) {
            return res
                .status(500)
                .json({ status: false, message: 'Internal Server Error' })
        }
    }
}

export default UserController
