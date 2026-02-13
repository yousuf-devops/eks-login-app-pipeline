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

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(session({
  secret: 'login-app-secret-key',
  name: 'sessionId',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: { 
    secure: false,
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax'
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
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Login - Secure Portal</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
        }
        .login-container {
          background: white;
          border-radius: 20px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          overflow: hidden;
          max-width: 900px;
          width: 100%;
          display: flex;
        }
        .login-left {
          flex: 1;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 60px 40px;
          color: white;
        }
        .login-left h1 { font-size: 2.5rem; margin-bottom: 20px; }
        .login-left p { font-size: 1.1rem; opacity: 0.9; }
        .login-right { flex: 1; padding: 60px 40px; }
        .login-header { text-align: center; margin-bottom: 40px; }
        .login-header h2 { font-size: 2rem; color: #333; }
        .form-group { margin-bottom: 25px; }
        .form-group label { display: block; margin-bottom: 8px; color: #333; font-weight: 500; }
        .form-group input {
          width: 100%;
          padding: 15px;
          border: 2px solid #e0e0e0;
          border-radius: 10px;
          font-size: 1rem;
        }
        .form-group input:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        .btn-login {
          width: 100%;
          padding: 15px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 10px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
        }
        .btn-login:hover { transform: translateY(-2px); }
        .message {
          margin-top: 20px;
          padding: 12px;
          border-radius: 8px;
          text-align: center;
          display: none;
        }
        .message.error { background: #fee; color: #c33; }
        .message.success { background: #efe; color: #3c3; }
        @media (max-width: 768px) {
          .login-container { flex-direction: column; }
        }
      </style>
    </head>
    <body>
      <div class="login-container">
        <div class="login-left">
          <h1>🚀 Welcome Back!</h1>
          <p>Login to access your secure dashboard.</p>
        </div>
        <div class="login-right">
          <div class="login-header">
            <h2>🔐 Sign In</h2>
          </div>
          <form id="loginForm">
            <div class="form-group">
              <label for="username">Username</label>
              <input type="text" id="username" name="username" required>
            </div>
            <div class="form-group">
              <label for="password">Password</label>
              <input type="password" id="password" name="password" required>
            </div>
            <button type="submit" class="btn-login">Sign In</button>
          </form>
          <div id="message" class="message"></div>
        </div>
      </div>
      <script>
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const username = document.getElementById('username').value;
          const password = document.getElementById('password').value;
          const messageDiv = document.getElementById('message');
          try {
            const response = await fetch('/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username, password })
            });
            const data = await response.json();
            if (response.ok) {
              messageDiv.className = 'message success';
              messageDiv.textContent = '✅ ' + data.message;
              messageDiv.style.display = 'block';
              setTimeout(() => window.location.href = '/dashboard', 1000);
            } else {
              messageDiv.className = 'message error';
              messageDiv.textContent = '❌ ' + data.message;
              messageDiv.style.display = 'block';
            }
          } catch (error) {
            messageDiv.className = 'message error';
            messageDiv.textContent = '❌ Error occurred';
            messageDiv.style.display = 'block';
          }
        });
      </script>
    </body>
    </html>
  `);
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
      if (err) return res.status(500).json({ message: 'Login failed' });
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.email = user.email;
      req.session.save((saveErr) => {
        if (saveErr) return res.status(500).json({ message: 'Login failed' });
        res.json({ message: 'Login successful!' });
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

app.get('/dashboard', isAuthenticated, (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Dashboard</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', sans-serif;
          background: #f5f7fa;
          min-height: 100vh;
        }
        .navbar {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 20px 40px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .navbar h1 { font-size: 1.8rem; }
        .btn-logout {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border: 2px solid white;
          padding: 10px 25px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 600;
        }
        .btn-logout:hover { background: white; color: #667eea; }
        .container { max-width: 1200px; margin: 40px auto; padding: 0 20px; }
        .welcome-card {
          background: white;
          border-radius: 15px;
          padding: 40px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
          margin-bottom: 30px;
        }
        .welcome-card h2 { color: #333; font-size: 2rem; }
        .user-details {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 15px;
          padding: 30px;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          padding: 12px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        }
      </style>
    </head>
    <body>
      <div class="navbar">
        <h1>🎯 Dashboard</h1>
        <button class="btn-logout" onclick="logout()">Logout</button>
      </div>
      <div class="container">
        <div class="welcome-card">
          <h2>✨ Welcome, ${req.session.username}!</h2>
        </div>
        <div class="user-details">
          <h3>📋 Account Information</h3>
          <div class="detail-row">
            <span>Username:</span>
            <span>${req.session.username}</span>
          </div>
          <div class="detail-row">
            <span>Email:</span>
            <span>${req.session.email}</span>
          </div>
          <div class="detail-row">
            <span>User ID:</span>
            <span>${req.session.userId}</span>
          </div>
        </div>
      </div>
      <script>
        async function logout() {
          const response = await fetch('/logout', { method: 'POST' });
          if (response.ok) window.location.href = '/';
        }
      </script>
    </body>
    </html>
  `);
});

app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ message: 'Logout failed' });
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
