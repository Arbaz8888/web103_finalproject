import express from 'express';
import OptionsController from '../controllers/options.js';

const router = express.Router();

router.get('/', OptionsController.getOptions);

export default router;
