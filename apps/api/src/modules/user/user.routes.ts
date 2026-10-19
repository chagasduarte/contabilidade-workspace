import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { UserController } from './user.controller';
import { authMiddleware } from '../../core/middlewares/auth.middleware';

const router = Router();

const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname.replace(/\s+/g, '_')}`;
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

router.post('/', upload.single('avatar'), UserController.criar);
router.get('/avatar', authMiddleware, UserController.getAvatar);
router.post('/:id/avatar', authMiddleware, upload.single('avatar'), UserController.uploadAvatar);
router.get('/:id/avatar', authMiddleware, UserController.getAvatar);

export default router;

