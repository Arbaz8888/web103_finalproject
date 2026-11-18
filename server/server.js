import express from 'express';
import './config/dotenv.js';
import cors from 'cors';
import HoldsRouter from './routes/holds.js';
import WallTypesRouter from './routes/wallTypes.js';
import ClimbingRoutesRouter from './routes/climbingRoutes.js';
import OptionsRouter from './routes/options.js';
import { errorHandler, notFound } from './middleware/errors.js';

const app = express();
app.use(express.json());
app.use(cors());

app.use('/api/holds', HoldsRouter);
app.use('/api/wall-types', WallTypesRouter);
app.use('/api/routes', ClimbingRoutesRouter);
app.use('/api/options', OptionsRouter);
app.use('/api', notFound);

const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
	res.status(200).send('<h1 style="text-align: center; margin-top: 50px;">Welcome to the Custom Climbing Routes API</h1>');
});

app.use(errorHandler);

app.listen(PORT, () => {
	console.log(`server listening on http://localhost:${PORT}`);
});
