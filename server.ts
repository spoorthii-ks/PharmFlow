import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import axios from 'axios';
import { Pool } from 'pg';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Database Configuration
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT || '5432'),
});

let useMockDb = !process.env.DB_HOST;

if (!useMockDb) {
  pool.connect((err, client, release) => {
    if (err) {
      console.error('Error connecting to PostgreSQL, falling back to mock DB:', err.message);
      useMockDb = true;
    } else {
      console.log('Connected to PostgreSQL database');
      release();
    }
  });
}

// Mock Database (Fallback for preview if no DB is configured)
const mockUsers: any[] = [];
const mockMedicines: any[] = [];
let userIdCounter = 1;
let medIdCounter = 1;

const JWT_SECRET = process.env.JWT_SECRET || 'pharmaflow_secret_key_2026';

// Google OAuth Config
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${process.env.APP_URL}/api/auth/google/callback`;

// Auth Middleware
const authMiddleware = (req: any, res: any, next: any) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Logic Helpers
const calculateMedicineStatus = (med: any) => {
  const today = new Date();
  const expiryDate = new Date(med.expiry_date);
  today.setHours(0, 0, 0, 0);
  expiryDate.setHours(0, 0, 0, 0);

  const diffTime = expiryDate.getTime() - today.getTime();
  const days_left = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let status = 'In Stock';
  if (expiryDate < today) {
    status = 'Expired';
  } else if (med.quantity <= 3) {
    status = 'Critical';
  } else if (med.quantity <= med.min_stock) {
    status = 'Low';
  }

  return { ...med, days_left, status };
};

// API Routes
app.post('/api/auth/signup', async (req, res) => {
  const { name, email, password } = req.body;
  
  if (useMockDb) {
    if (mockUsers.find(u => u.email === email)) {
      return res.status(400).json({ message: 'User already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = { id: userIdCounter++, name, email, password: hashedPassword };
    mockUsers.push(newUser);
    const token = jwt.sign({ id: newUser.id }, JWT_SECRET, { expiresIn: '7d' });
    return res.status(201).json({ token, user: { id: newUser.id, name, email } });
  }

  try {
    const existingUser = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email',
      [name, email, hashedPassword]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ token, user });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (useMockDb) {
    const user = mockUsers.find(u => u.email === email);
    if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, user: { id: user.id, name: user.name, email } });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || !user.password || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user.id, name: user.name, email } });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Google OAuth Endpoints
app.get('/api/auth/google/url', (req, res) => {
  const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${GOOGLE_REDIRECT_URI}&response_type=code&scope=profile email`;
  res.json({ url });
});

app.get('/api/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).send('No code provided');

  try {
    const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code'
    });

    const { access_token } = tokenResponse.data;
    const userResponse = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` }
    });

    const { sub, name, email } = userResponse.data;

    let user;
    if (useMockDb) {
      user = mockUsers.find(u => u.email === email);
      if (!user) {
        user = { id: userIdCounter++, name, email, googleId: sub };
        mockUsers.push(user);
      }
    } else {
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      user = result.rows[0];
      if (!user) {
        const insertResult = await pool.query(
          'INSERT INTO users (name, email, google_id) VALUES ($1, $2, $3) RETURNING id, name, email',
          [name, email, sub]
        );
        user = insertResult.rows[0];
      }
    }

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ 
                type: 'OAUTH_AUTH_SUCCESS', 
                token: '${token}', 
                user: ${JSON.stringify({ id: user.id, name: user.name, email: user.email })} 
              }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <p>Authentication successful. This window should close automatically.</p>
        </body>
      </html>
    `);
  } catch (err: any) {
    console.error('Google OAuth error:', err.response?.data || err.message);
    res.status(500).send('Authentication failed');
  }
});

app.get('/api/medicines', authMiddleware, async (req: any, res) => {
  if (useMockDb) {
    const userMeds = mockMedicines.filter(m => m.user_id === req.user.id);
    return res.json(userMeds.map(calculateMedicineStatus));
  }

  try {
    const result = await pool.query('SELECT * FROM medicines WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
    res.json(result.rows.map(calculateMedicineStatus));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.post('/api/medicines', authMiddleware, async (req: any, res) => {
  const { name, quantity, min_stock, expiry_date } = req.body;

  if (useMockDb) {
    const newMed = {
      id: medIdCounter++,
      user_id: req.user.id,
      name,
      quantity: parseInt(quantity),
      min_stock: parseInt(min_stock),
      expiry_date
    };
    mockMedicines.push(newMed);
    return res.status(201).json(calculateMedicineStatus(newMed));
  }

  try {
    const result = await pool.query(
      'INSERT INTO medicines (user_id, name, quantity, min_stock, expiry_date) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.user.id, name, parseInt(quantity), parseInt(min_stock), expiry_date]
    );
    res.status(201).json(calculateMedicineStatus(result.rows[0]));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.put('/api/medicines/:id', authMiddleware, async (req: any, res) => {
  const { id } = req.params;
  const { name, quantity, min_stock, expiry_date } = req.body;

  if (useMockDb) {
    const index = mockMedicines.findIndex(m => m.id === parseInt(id) && m.user_id === req.user.id);
    if (index === -1) return res.status(404).json({ message: 'Medicine not found' });
    
    mockMedicines[index] = {
      ...mockMedicines[index],
      name,
      quantity: parseInt(quantity),
      min_stock: parseInt(min_stock),
      expiry_date
    };
    return res.json(calculateMedicineStatus(mockMedicines[index]));
  }

  try {
    const result = await pool.query(
      'UPDATE medicines SET name = $1, quantity = $2, min_stock = $3, expiry_date = $4 WHERE id = $5 AND user_id = $6 RETURNING *',
      [name, parseInt(quantity), parseInt(min_stock), expiry_date, id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Medicine not found' });
    res.json(calculateMedicineStatus(result.rows[0]));
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

app.delete('/api/medicines/:id', authMiddleware, async (req: any, res) => {
  const { id } = req.params;

  if (useMockDb) {
    const index = mockMedicines.findIndex(m => m.id === parseInt(id) && m.user_id === req.user.id);
    if (index === -1) return res.status(404).json({ message: 'Medicine not found' });
    mockMedicines.splice(index, 1);
    return res.json({ message: 'Deleted' });
  }

  try {
    const result = await pool.query('DELETE FROM medicines WHERE id = $1 AND user_id = $2 RETURNING id', [id, req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Medicine not found' });
    res.json({ message: 'Deleted' });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
});

// Vite Integration
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
