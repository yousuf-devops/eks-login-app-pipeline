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

// HTTPS FIX: Trust proxy for secure cookies
app.set('trust proxy', 1);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(session({
  secret: 'login-app-secret-key-change-in-production',
  name: 'sessionId',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    secure: 'auto',  // HTTPS FIX: Changed to true
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

// LOGIN PAGE - Ultra Modern Design
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
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      position: relative;
      overflow: hidden;
    }
    
    /* Animated background particles */
    body::before {
      content: '';
      position: absolute;
      width: 200%;
      height: 200%;
      background: radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px);
      background-size: 50px 50px;
      animation: moveBackground 20s linear infinite;
    }
    
    @keyframes moveBackground {
      0% { transform: translate(0, 0); }
      100% { transform: translate(50px, 50px); }
    }
    
    .login-container {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 24px;
      box-shadow: 0 30px 90px rgba(0, 0, 0, 0.3);
      overflow: hidden;
      max-width: 1100px;
      width: 100%;
      display: grid;
      grid-template-columns: 1fr 1fr;
      position: relative;
      z-index: 1;
      animation: slideUp 0.6s ease-out;
    }
    
    @keyframes slideUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .left-panel {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 60px;
      color: white;
      display: flex;
      flex-direction: column;
      justify-content: center;
      position: relative;
      overflow: hidden;
    }
    
    .left-panel::before {
      content: '';
      position: absolute;
      width: 300px;
      height: 300px;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 50%;
      top: -100px;
      right: -100px;
    }
    
    .left-panel::after {
      content: '';
      position: absolute;
      width: 200px;
      height: 200px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 50%;
      bottom: -50px;
      left: -50px;
    }
    
    .logo {
      font-size: 3.5em;
      margin-bottom: 20px;
      animation: bounce 2s ease-in-out infinite;
    }
    
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    
    .left-panel h1 {
      font-size: 2.8em;
      margin-bottom: 20px;
      font-weight: 700;
      position: relative;
      z-index: 1;
    }
    
    .left-panel p {
      font-size: 1.15em;
      line-height: 1.8;
      opacity: 0.95;
      position: relative;
      z-index: 1;
    }
    
    .features {
      margin-top: 40px;
      position: relative;
      z-index: 1;
    }
    
    .feature-item {
      display: flex;
      align-items: center;
      margin-bottom: 15px;
      animation: fadeIn 0.8s ease-out;
    }
    
    .feature-item::before {
      content: '✓';
      background: rgba(255, 255, 255, 0.2);
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 12px;
      font-weight: bold;
    }
    
    @keyframes fadeIn {
      from { opacity: 0; transform: translateX(-20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    
    .right-panel {
      padding: 60px;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    
    .right-panel h2 {
      font-size: 2.2em;
      margin-bottom: 15px;
      color: #2d3748;
      font-weight: 700;
    }
    
    .subtitle {
      color: #718096;
      margin-bottom: 40px;
      font-size: 1.05em;
    }
    
    .form-group {
      margin-bottom: 25px;
    }
    
    .form-group label {
      display: block;
      margin-bottom: 10px;
      color: #4a5568;
      font-weight: 600;
      font-size: 0.95em;
      letter-spacing: 0.3px;
    }
    
    .input-wrapper {
      position: relative;
    }
    
    .input-icon {
      position: absolute;
      left: 15px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 1.2em;
      color: #a0aec0;
    }
    
    .form-group input {
      width: 100%;
      padding: 14px 15px 14px 45px;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      font-size: 1em;
      transition: all 0.3s ease;
      background: #f7fafc;
    }
    
    .form-group input:focus {
      outline: none;
      border-color: #667eea;
      background: white;
      box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
      transform: translateY(-1px);
    }
    
    .btn-login {
      width: 100%;
      padding: 16px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 1.1em;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s ease;
      box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
      position: relative;
      overflow: hidden;
    }
    
    .btn-login::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 0;
      height: 0;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      transform: translate(-50%, -50%);
      transition: width 0.6s, height 0.6s;
    }
    
    .btn-login:hover::before {
      width: 300px;
      height: 300px;
    }
    
    .btn-login:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 25px rgba(102, 126, 234, 0.5);
    }
    
    .btn-login:active {
      transform: translateY(0);
    }
    
    .error-message {
      background: linear-gradient(135deg, #fc5c7d 0%, #f54c64 100%);
      color: white;
      padding: 14px;
      border-radius: 10px;
      margin-bottom: 20px;
      display: none;
      animation: shake 0.5s;
      font-weight: 500;
    }
    
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      25% { transform: translateX(-10px); }
      75% { transform: translateX(10px); }
    }
    
    .secure-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: 30px;
      color: #718096;
      font-size: 0.9em;
    }
    
    .secure-badge::before {
      content: '🔒';
      margin-right: 8px;
      font-size: 1.2em;
    }
    
    @media (max-width: 968px) {
      .login-container {
        grid-template-columns: 1fr;
      }
      .left-panel {
        padding: 40px;
      }
      .right-panel {
        padding: 40px;
      }
    }
  </style>
</head>
<body>
  <div class="login-container">
    <div class="left-panel">
      <div class="logo">🚀</div>
      <h1>Welcome Back!</h1>
      <p>Access your secure dashboard and manage your account with enterprise-grade security and modern tools.</p>
      <div class="features">
        <div class="feature-item">Enterprise-grade encryption</div>
        <div class="feature-item">24/7 secure access</div>
        <div class="feature-item">Real-time monitoring</div>
      </div>
    </div>
    
    <div class="right-panel">
      <h2>Sign In</h2>
      <p class="subtitle">Enter your credentials to continue</p>
      
      <div id="error-message" class="error-message"></div>
      
      <form id="login-form">
        <div class="form-group">
          <label>Username</label>
          <div class="input-wrapper">
            <span class="input-icon">👤</span>
            <input type="text" id="username" name="username" required autocomplete="username">
          </div>
        </div>
        
        <div class="form-group">
          <label>Password</label>
          <div class="input-wrapper">
            <span class="input-icon">🔑</span>
            <input type="password" id="password" name="password" required autocomplete="current-password">
          </div>
        </div>
        
        <button type="submit" class="btn-login">Sign In</button>
      </form>
      
      <div class="secure-badge">Secured with SSL/TLS encryption</div>
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
          body: JSON.stringify({ username, password }),
          credentials: 'include'
        });
        
        const data = await response.json();
        
        if (response.ok) {
          window.location.href = '/dashboard';
        } else {
          errorDiv.textContent = '⚠️ ' + data.message;
          errorDiv.style.display = 'block';
          setTimeout(() => {
            errorDiv.style.display = 'none';
          }, 4000);
        }
      } catch (error) {
        errorDiv.textContent = '⚠️ Connection error. Please try again.';
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
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    
    const user = rows[0];
    
    if (password !== user.password) {
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    
    req.session.regenerate((err) => {
      if (err) {
        console.error('Session regeneration error:', err);
        return res.status(500).json({ message: 'Login failed. Please try again.' });
      }
      
      req.session.userId = user.id;
      req.session.username = user.username;
      req.session.email = user.email;
      
      req.session.save((saveErr) => {
        if (saveErr) {
          console.error('Session save error:', saveErr);
          return res.status(500).json({ message: 'Login failed. Please try again.' });
        }
        res.json({ message: 'Login successful!' });
      });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error. Please try again.' });
  }
});

// DASHBOARD - Ultra Modern with Cards
app.get('/dashboard', isAuthenticated, (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dashboard - ${req.session.username}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
      min-height: 100vh;
    }
    
    /* Header */
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      position: sticky;
      top: 0;
      z-index: 100;
    }
    
    .header-left {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    
    .header-left h1 {
      font-size: 1.8em;
      font-weight: 700;
    }
    
    .user-info {
      display: flex;
      align-items: center;
      gap: 15px;
    }
    
    .avatar {
      width: 45px;
      height: 45px;
      border-radius: 50%;
      background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.3em;
      font-weight: bold;
      border: 3px solid rgba(255, 255, 255, 0.3);
    }
    
    .logout-btn {
      padding: 10px 24px;
      background: rgba(255, 255, 255, 0.2);
      border: 2px solid white;
      color: white;
      border-radius: 10px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.3s ease;
      font-size: 0.95em;
    }
    
    .logout-btn:hover {
      background: white;
      color: #667eea;
      transform: translateY(-2px);
      box-shadow: 0 4px 15px rgba(255, 255, 255, 0.3);
    }
    
    /* Main Container */
    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    
    /* Welcome Section */
    .welcome-section {
      background: white;
      padding: 40px;
      border-radius: 20px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
      margin-bottom: 40px;
      animation: slideDown 0.6s ease-out;
    }
    
    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .welcome-section h2 {
      font-size: 2.5em;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 10px;
    }
    
    .welcome-section p {
      color: #718096;
      font-size: 1.15em;
      line-height: 1.6;
    }
    
    /* Stats Grid */
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 25px;
      margin-bottom: 40px;
    }
    
    .stat-card {
      background: white;
      padding: 35px;
      border-radius: 20px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
      transition: all 0.4s ease;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      animation: fadeInUp 0.6s ease-out;
      animation-fill-mode: both;
    }
    
    .stat-card:nth-child(1) { animation-delay: 0.1s; }
    .stat-card:nth-child(2) { animation-delay: 0.2s; }
    .stat-card:nth-child(3) { animation-delay: 0.3s; }
    .stat-card:nth-child(4) { animation-delay: 0.4s; }
    
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .stat-card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 5px;
      background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
      transform: scaleX(0);
      transition: transform 0.3s ease;
    }
    
    .stat-card:hover::before {
      transform: scaleX(1);
    }
    
    .stat-card:hover {
      transform: translateY(-10px);
      box-shadow: 0 20px 60px rgba(102, 126, 234, 0.3);
    }
    
    .stat-icon {
      font-size: 3.5em;
      margin-bottom: 20px;
      display: inline-block;
      animation: float 3s ease-in-out infinite;
    }
    
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    
    .stat-card h3 {
      color: #2d3748;
      font-size: 1.3em;
      margin-bottom: 10px;
      font-weight: 600;
    }
    
    .stat-card p {
      color: #718096;
      line-height: 1.5;
    }
    
    /* Info Section */
    .info-section {
      background: white;
      padding: 40px;
      border-radius: 20px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.08);
      animation: fadeInUp 0.8s ease-out;
    }
    
    .info-section h3 {
      font-size: 1.8em;
      margin-bottom: 30px;
      color: #2d3748;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
    }
    
    .info-item {
      padding: 20px;
      background: linear-gradient(135deg, #f5f7fa 0%, #e9ecef 100%);
      border-radius: 12px;
      border-left: 4px solid #667eea;
      transition: all 0.3s ease;
    }
    
    .info-item:hover {
      transform: translateX(5px);
      box-shadow: 0 5px 15px rgba(102, 126, 234, 0.2);
    }
    
    .info-label {
      font-weight: 600;
      color: #4a5568;
      margin-bottom: 8px;
      font-size: 0.9em;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .info-value {
      color: #2d3748;
      font-size: 1.2em;
      font-weight: 500;
    }
    
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: 600;
      font-size: 0.95em;
    }
    
    @media (max-width: 768px) {
      .header {
        flex-direction: column;
        gap: 15px;
        text-align: center;
      }
      .stats-grid {
        grid-template-columns: 1fr;
      }
      .info-grid {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>🎯 Dashboard</h1>
    </div>
    <div class="user-info">
      <div class="avatar">${req.session.username.charAt(0).toUpperCase()}</div>
      <span style="font-weight: 600;">${req.session.username}</span>
      <button class="logout-btn" onclick="logout()">Logout</button>
    </div>
  </div>
  
  <div class="container">
    <div class="welcome-section">
      <h2>✨ Welcome back, ${req.session.username}!</h2>
      <p>You're successfully logged in to your secure dashboard. Manage your account, view analytics, and access all features from this centralized hub.</p>
    </div>
    
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon">📊</div>
        <h3>Analytics</h3>
        <p>View comprehensive performance metrics and insights</p>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">⚙️</div>
        <h3>Settings</h3>
        <p>Configure your preferences and account settings</p>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">📱</div>
        <h3>Notifications</h3>
        <p>Stay updated with real-time alerts and messages</p>
      </div>
      
      <div class="stat-card">
        <div class="stat-icon">🔒</div>
        <h3>Security</h3>
        <p>Manage your security settings and privacy options</p>
      </div>
    </div>
    
    <div class="info-section">
      <h3>📋 Account Information</h3>
      <div class="info-grid">
        <div class="info-item">
          <div class="info-label">Username</div>
          <div class="info-value">${req.session.username}</div>
        </div>
        
        <div class="info-item">
          <div class="info-label">Email Address</div>
          <div class="info-value">${req.session.email}</div>
        </div>
        
        <div class="info-item">
          <div class="info-label">User ID</div>
          <div class="info-value">#${req.session.userId}</div>
        </div>
        
        <div class="info-item">
          <div class="info-label">Account Status</div>
          <div class="info-value">
            <span class="status-badge">✓ Active</span>
          </div>
        </div>
      </div>
    </div>
  </div>
  
  <script>
    async function logout() {
      if (confirm('Are you sure you want to logout?')) {
        try {
          const response = await fetch('/logout', { 
            method: 'POST',
            credentials: 'include'
          });
          if (response.ok) {
            window.location.href = '/';
          }
        } catch (error) {
          console.error('Logout error:', error);
          alert('Logout failed. Please try again.');
        }
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
