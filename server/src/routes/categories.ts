import { Router, Request, Response } from 'express';
import { db } from '../db/store';

const router = Router();

// GET /api/v1/categories
router.get('/', (req: Request, res: Response): void => {
  const categories = db.getCategories();
  res.json({
    success: true,
    data: categories,
  });
});

export default router;
