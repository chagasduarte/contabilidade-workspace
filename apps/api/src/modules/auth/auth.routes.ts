import { Router } from 'express';
import { AuthController } from './auth.controller';

const router = Router();

router.post('/login', AuthController.login);
router.post('/register', AuthController.register);
router.post('/', AuthController.login);

export default router;

