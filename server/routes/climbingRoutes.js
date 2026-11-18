import express from 'express';
import ClimbingRoutesController from '../controllers/climbingRoutes.js';

const router = express.Router();

const MAX_POSTGRES_INT = 2147483647;

// Any :id that isn't a positive 32-bit integer can't match a route
router.param('id', (req, res, next, id) => {
	if (!/^[1-9]\d*$/.test(id) || Number(id) > MAX_POSTGRES_INT) {
		return res.status(404).json({ error: 'Route not found.' });
	}
	next();
});

router.post('/reset', ClimbingRoutesController.resetRoutes);

router.get('/', ClimbingRoutesController.getRoutes);
router.get('/:id', ClimbingRoutesController.getRouteById);
router.post('/', ClimbingRoutesController.createRoute);
router.put('/:id', ClimbingRoutesController.updateRoute);
router.patch('/:id', ClimbingRoutesController.updateRoute);
router.delete('/:id', ClimbingRoutesController.deleteRoute);

export default router;
