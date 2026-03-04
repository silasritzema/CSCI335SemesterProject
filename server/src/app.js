import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import licenseRoutes from './routes/license.js';

const app = express();

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/license', licenseRoutes);

export default app;