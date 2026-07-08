import fs from 'fs'
import multer from 'multer'
import path from 'path'

const TMP_DIR = path.join(process.cwd(), 'tmp')

if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true })
}

export const uploadMiddleware = multer({
    dest: TMP_DIR,
    limits: {
        fileSize: 4 * 1024 * 1024 * 1024,
    },
})
