import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { attachUpgrade } from './geminiSession.js';
import liveRouter from './liveRouter.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);  
const __dirname = path.dirname(__filename);  // Get the directory name of the current module

const app = express();  // Create an Express application
app.use(cors());  // Enable CORS for all routes
app.use(express.json({ limit: '2mb' })); // Parse JSON request bodies with a size limit

app.use('/', express.static(path.join(__dirname, '../web')));
app.use('/api/live', liveRouter);

const PORT = process.env.PORT || 3000;
const server = createServer(app);
attachUpgrade(server);
server.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
server.on('error', (err) => {
  console.error('Server error:', err);
}); 