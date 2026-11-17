import express from 'express';
import dotenv from 'dotenv';
import { initDatabase } from '../server/db.ts';
import { createApiRouter } from '../server/routes.ts';

dotenv.config();
initDatabase();

const app = express();

app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

app.use('/api', createApiRouter());

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

export default app;
