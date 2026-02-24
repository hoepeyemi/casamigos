import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';

import registerRoutes from './routes/register';
import yakoaRoutes from './routes/yakoaRoutes';
import licenseRoutes from './routes/license';
import infringementRoutes from './routes/infringement';
import creEventsRoutes from './routes/creEvents';
import registerIpYakoaRoutes from './routes/registerIpYakoa';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// API Routes
app.use('/api/register', registerRoutes);
app.use('/api/yakoa', yakoaRoutes);
app.use('/api/license', licenseRoutes);
app.use('/api/infringement', infringementRoutes);
app.use('/api/cre-events', creEventsRoutes);
app.use('/api/register-ip-yakoa', registerIpYakoaRoutes);

// Default route (optional)
app.get('/', (_req, res) => {
  res.send('✅ Yakoa + Base Sepolia backend is running!');
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running at http://localhost:${PORT}`);
});
