import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { UserController } from './user.controller';
import { authMiddleware } from '../../core/middlewares/auth.middleware';

const router = Router();

const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

const AVATAR_MIME_EXT: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    // Nome gerado no servidor: não reaproveita originalname (evita path traversal/extensões forjadas)
    const ext = AVATAR_MIME_EXT[file.mimetype] ?? '.img';
    const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: AVATAR_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!AVATAR_MIME_EXT[file.mimetype]) {
      const err = new Error('Tipo de arquivo não permitido. Envie uma imagem JPEG, PNG, WEBP ou GIF.');
      (err as unknown as { statusCode: number }).statusCode = 400;
      cb(err);
      return;
    }
    cb(null, true);
  },
});

router.post('/', upload.single('avatar'), UserController.criar);
router.get('/me', authMiddleware, UserController.me);
router.put('/me', authMiddleware, UserController.atualizarMe);
router.get('/avatar', authMiddleware, UserController.getAvatar);
router.post('/:id/avatar', authMiddleware, upload.single('avatar'), UserController.uploadAvatar);
router.get('/:id/avatar', authMiddleware, UserController.getAvatar);

export default router;

