import { Router } from 'express';
import { analyze } from '../controllers/stockController';

const router = Router();

router.get('/analyze/:ticker', analyze);

export default router;
