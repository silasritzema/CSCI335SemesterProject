import express from 'express';
import cors from 'cors';
import authRoutes from './src/routes/auth.js';

const app = express();

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/auth', authRoutes);

export default app;