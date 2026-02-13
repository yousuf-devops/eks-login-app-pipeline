const express = require('express');
const mysql = require('mysql2/promise');
const session = require('express-session');
const bodyParser = require('body-parser');
const fs = require('fs');
const app = express();
const PORT = 3000;
let pool;

const DB_HOST = fs.readFileSync(process.env.DB_HOST || '/secrets/DB_HOST', 'utf8').trim();
const DB_NAME = fs.readFileSync(process.env.DB_NAME || '/secrets/DB_NAME', 'utf8').trim();
const DB_USER = fs.readFileSync(process.env.DB_USER || '/secrets/DB_USER', 'utf8').trim();
const DB_PASSWORD = fs.readFileSync(process.env.DB_PASSWORD || '/secrets/DB_PASSWORD', 'utf8').trim();

console.log(`Connecting to database: ${DB_HOST}`);

pool = mysql.createPool({
  host: DB_HOST,
  port: 3306,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

console.log('✅ Database pool created');

(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connection successful!');
    connection.release();
  } catch (error) {
    console.error('❌ Failed to connect to database:', error.message);
    process.exit(1);
  }
})();

// Trust proxy - IMPORTANT for HTTPS behind load balancer
app.set('trust proxy', 1);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(session({
  secret: 'login-app-secret-key-change-this-in-production',
  name: 'sessionId',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: true,  // Changed to true for HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: 'lax',
    domain: undefined  // Let browser handle domain
  }
}));

function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    return next();
  }
  res.redirect('/');
}

app.get('/', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login - Secure Portal</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 20px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
      max-width: 1000px;
      width: 100%;
      display: flex;
    }
    .left-panel {
      flex: 1;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 60px 40px;
      color: white;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .left-panel h1 { font-size: 2.5em; margin-bottom: 20px; }
    .left-panel p { font-size: 1.1em; opacity: 0.9; line-height: 1.6; }
    .right-panel {
      flex: 1;
      padding: 60px 40px;
    }
    .right-panel h2 { font-size: 2em; margin-bottom: 30px; color: #333; }
    .form-group { margin-bottom: 25px; }
    .form-group label {
      display: block;
      margin-bottom: 8px;
      color: #555;
      font-weight: 600;
    }
    .form-group input {
      width: 100%;
      padding: 12px 15px;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 1em;
      transition: all 0.3s;
    }
    .form-group input:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }
    .btn-login {
      width: 100%;
      padding: 14px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 1.1em;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s;
    }
    .btn-login:hover { transform: translateY(-2px); }
    .error-message {
      background: #fee;
      color: #c33;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 20px;
      display: none;
    }
    @media (max-width: 768px) {
      .container { flex-direction: column; }
      .left-panel { padding: 40px 20px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="left-panel">
      <h1>🚀 Welcome Back!</h1>
      <p>Login to access your secure dashboard and manage your account with ease.</p>
    </div>
    <div class="right-panel">
      <h2>🔐 Sign In</h2>
      <div id="error-message" class="error-message"></div>
      <form id="login-form">
        <div class="form-group">
          <label>Username</label>
          <input type="text" id="username" name="username" required>
        </div>
        <div class="form-group">
          <label>Password</label>
          <input type="password" id="password" name="password" required>
        </div>
        <button type="submit" class="btn-login">Sign In</button>
      </form>
    </div>
  </div>
  <script>
    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      const errorDiv = document.getElementById('error-message');
      
      try {
        const response = await fetch('/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
          window.location.href = '/dashboard';
        } else {
          errorDiv.textContent = data.message;
          errorDiv.style.display = 'block';
        }
      } catch (error) {
        errorDiv.textContent = 'Connection error. Please try again.';
        errorDiv.style.display = 'block';
      }
    });
  </script>
</body>
</html>`);
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password required' });
  }
  
  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
    
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    const user = rows[0];
    
    if (password !== user.password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration error:', err);
        return res.status(500).json({ message: 'Login failed' });
      }
      
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.email = user.email;
      
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Session save error:', saveErr);
          return res.status(500).json({ message: 'Login failed' });
        }
        res.json({ message: 'Login successful!' });
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/dashboard', isAuthenticated, (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #f5f7fa;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header h1 { font-size: 1.8em; }
    .logout-btn {
      padding: 10px 20px;
      background: rgba(255,255,255,0.2);
      border: 2px solid white;
      color: white;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.3s;
    }
    .logout-btn:hover { background: white; color: #667eea; }
    .container {
      max-width: 1200px;
      margin: 40px auto;
      padding: 0 20px;
    }
    .welcome-card {
      background: white;
      padding: 40px;
      border-radius: 15px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      margin-bottom: 30px;
    }
    .welcome-card h2 { color: #667eea; margin-bottom: 10px; }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-top: 30px;
    }
    .stat-card {
      background: white;
      padding: 30px;
      border-radius: 15px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      text-align: center;
      transition: transform 0.3s;
    }
    .stat-card:hover { transform: translateY(-5px); }
    .stat-card .icon { font-size: 3em; margin-bottom: 15px; }
    .stat-card h3 { color: #333; margin-bottom: 10px; }
    .stat-card p { color: #666; }
    .info-table {
      background: white;
      padding: 30px;
      border-radius: 15px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      margin-top: 30px;
    }
    .info-table h3 { margin-bottom: 20px; color: #667eea; }
    .info-row {
      display: flex;
      padding: 15px 0;
      border-bottom: 1px solid #eee;
    }
    .info-row:last-child { border-bottom: none; }
    .info-label { font-weight: 600; color: #555; flex: 1; }
    .info-value { color: #333; flex: 2; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎯 Dashboard</h1>
    <button class="logout-btn" onclick="logout()">Logout</button>
  </div>
  <div class="container">
    <div class="welcome-card">
      <h2>✨ Welcome, ${req.session.username}!</h2>
      <p>You've successfully logged in to your secure dashboard.</p>
    </div>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="icon">📊</div>
        <h3>Analytics</h3>
        <p>View performance metrics</p>
      </div>
      <div class="stat-card">
        <div class="icon">⚙️</div>
        <h3>Settings</h3>
        <p>Configure preferences</p>
      </div>
      <div class="stat-card">
        <div class="icon">📱</div>
        <h3>Notifications</h3>
        <p>Stay updated</p>
      </div>
      <div class="stat-card">
        <div class="icon">🔒</div>
        <h3>Security</h3>
        <p>Manage security</p>
      </div>
    </div>
    <div class="info-table">
      <h3>📋 Account Information</h3>
      <div class="info-row">
        <div class="info-label">Username:</div>
        <div class="info-value">${req.session.username}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Email:</div>
        <div class="info-value">${req.session.email}</div>
      </div>
      <div class="info-row">
        <div class="info-label">User ID:</div>
        <div class="info-value">${req.session.userId}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Account Status:</div>
        <div class="info-value">✅ Active</div>
      </div>
    </div>
  </div>
  <script>
    async function logout() {
      try {
        const response = await fetch('/logout', { method: 'POST' });
        if (response.ok) {
          window.location.href = '/';
        }
      } catch (error) {
        console.error('Logout error:', error);
      }
    }
  </script>
</body>
</html>`);
});

app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ message: 'Logout failed' });
    }
    res.clearCookie('sessionId');
    res.json({ message: 'Logged out successfully' });
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: pool ? 'connected' : 'disconnected'
  });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
