const express = require('express');
const mysql = require('mysql2/promise');
const session = require('express-session');
const bodyParser = require('body-parser');
const fs = require('fs');
const promClient = require('prom-client');

const app = express();
const PORT = 3000;

// ========================================
// PROMETHEUS METRICS SETUP
// ========================================
const register = new promClient.Registry();
promClient.collectDefaultMetrics({ register });

// Custom metrics
const loginAttempts = new promClient.Counter({
  name: 'login_attempts_total',
  help: 'Total login attempts',
  labelNames: ['status'],
  registers: [register]
});

const activeUsers = new promClient.Gauge({
  name: 'active_users',
  help: 'Number of active user sessions',
  registers: [register]
});

const httpDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

// Trust proxy
app.set('trust proxy', 1);

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Session configuration
app.use(session({
  secret: 'login-app-secret-key-change-in-production',
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

// Track request duration middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpDuration.labels(req.method, req.path, res.statusCode).observe(duration);
  });
  next();
});

// Read database credentials from secrets
const DB_HOST = fs.readFileSync(process.env.DB_HOST, 'utf8').trim();
const DB_NAME = fs.readFileSync(process.env.DB_NAME, 'utf8').trim();
const DB_USER = fs.readFileSync(process.env.DB_USER, 'utf8').trim();
const DB_PASSWORD = fs.readFileSync(process.env.DB_PASSWORD, 'utf8').trim();

console.log(`Connecting to database: ${DB_HOST}`);

let pool;

async function initDB() {
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
  const connection = await pool.getConnection();
  console.log('✅ Database connection successful!');
  connection.release();
}

// Middleware to check authentication
function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  res.redirect('/');
}

// ========================================
// ROUTES
// ========================================

// Metrics endpoint (for Prometheus)
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Login page
app.get('/', (req, res) => {
  if (req.session && req.session.userId) {
    console.log(`User ${req.session.username} already logged in, redirecting to dashboard`);
    return res.redirect('/dashboard');
  }
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Login Application</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .container {
          background: white;
          padding: 40px;
          border-radius: 15px;
          box-shadow: 0 15px 35px rgba(0,0,0,0.3);
          width: 100%;
          max-width: 400px;
        }
        h1 {
          color: #667eea;
          text-align: center;
          margin-bottom: 30px;
        }
        .form-group {
          margin-bottom: 20px;
        }
        label {
          display: block;
          margin-bottom: 8px;
          color: #333;
          font-weight: 500;
        }
        input {
          width: 100%;
          padding: 12px;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-size: 14px;
        }
        input:focus {
          outline: none;
          border-color: #667eea;
        }
        button {
          width: 100%;
          padding: 14px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 600;
          transition: all 0.3s;
        }
        button:hover {
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(102, 126, 234, 0.4);
        }
        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .message {
          margin-top: 20px;
          padding: 12px;
          border-radius: 8px;
          text-align: center;
          display: none;
        }
        .message.show { display: block; }
        .message.error {
          background: #fee;
          color: #c33;
          border: 1px solid #fcc;
        }
        .message.success {
          background: #efe;
          color: #3c3;
          border: 1px solid #cfc;
        }
        .test-info {
          margin-top: 20px;
          padding: 15px;
          background: #f8f9fa;
          border-radius: 8px;
          text-align: center;
          font-size: 13px;
          color: #666;
        }
        .test-info code {
          background: #e9ecef;
          padding: 2px 8px;
          border-radius: 4px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🔐 Login</h1>
        <form id="loginForm">
          <div class="form-group">
            <label for="username">Username</label>
            <input type="text" id="username" placeholder="Enter username" required autocomplete="username">
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" placeholder="Enter password" required autocomplete="current-password">
          </div>
          <button type="submit" id="loginBtn">Sign In</button>
        </form>
        <div id="message" class="message"></div>
        <div class="test-info">
          <strong>Test Credentials:</strong><br>
          Username: <code>admin</code><br>
          Password: <code>password</code>
        </div>
      </div>
      <script>
        const form = document.getElementById('loginForm');
        const loginBtn = document.getElementById('loginBtn');
        const messageDiv = document.getElementById('message');

        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          
          const username = document.getElementById('username').value;
          const password = document.getElementById('password').value;
          
          loginBtn.disabled = true;
          loginBtn.textContent = 'Signing in...';
          messageDiv.className = 'message show';
          messageDiv.textContent = 'Authenticating...';
          
          try {
            const response = await fetch('/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username, password }),
              credentials: 'include'
            });
            
            const data = await response.json();
            
            if (response.ok) {
              messageDiv.className = 'message success show';
              messageDiv.textContent = '✓ Success! Redirecting...';
              
              setTimeout(() => {
                window.location.replace('/dashboard');
              }, 800);
            } else {
              messageDiv.className = 'message error show';
              messageDiv.textContent = '✗ ' + data.message;
              loginBtn.disabled = false;
              loginBtn.textContent = 'Sign In';
            }
          } catch (error) {
            messageDiv.className = 'message error show';
            messageDiv.textContent = '✗ Connection error';
            loginBtn.disabled = false;
            loginBtn.textContent = 'Sign In';
            console.error('Error:', error);
          }
        });
      </script>
    </body>
    </html>
  `);
});

// Login endpoint
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    loginAttempts.labels('missing_credentials').inc();
    return res.status(400).json({ message: 'Username and password required' });
  }
  
  try {
    const [rows] = await pool.execute('SELECT * FROM users WHERE username = ?', [username]);
    
    if (rows.length === 0) {
      loginAttempts.labels('user_not_found').inc();
      return res.status(401).json({ message: 'Invalid username or password' });
    }
    
    const user = rows[0];
    
    if (password === user.password) {
      req.session.regenerate((err) => {
        if (err) {
          console.error('Session regeneration error:', err);
          loginAttempts.labels('session_error').inc();
          return res.status(500).json({ message: 'Session error' });
        }
        
        req.session.userId = user.id;
        req.session.username = user.username;
        req.session.email = user.email;
        
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error('Session save error:', saveErr);
            loginAttempts.labels('session_error').inc();
            return res.status(500).json({ message: 'Login failed' });
          }
          
          loginAttempts.labels('success').inc();
          activeUsers.inc();
          console.log(`✅ User ${username} logged in successfully`);
          res.json({ message: 'Login successful!', success: true });
        });
      });
    } else {
      loginAttempts.labels('wrong_password').inc();
      res.status(401).json({ message: 'Invalid username or password' });
    }
  } catch (error) {
    loginAttempts.labels('server_error').inc();
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Dashboard page
app.get('/dashboard', isAuthenticated, (req, res) => {
  console.log(`✅ Dashboard accessed by: ${req.session.username}`);
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Dashboard - ${req.session.username}</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          padding: 20px;
        }
        .container {
          max-width: 900px;
          margin: 0 auto;
          background: white;
          padding: 40px;
          border-radius: 15px;
          box-shadow: 0 15px 35px rgba(0,0,0,0.3);
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #e0e0e0;
          flex-wrap: wrap;
        }
        h1 { 
          color: #333;
          margin-bottom: 10px;
        }
        .user-info { 
          text-align: right;
        }
        .username {
          color: #667eea;
          font-weight: 600;
          font-size: 18px;
        }
        .email {
          color: #666;
          font-size: 14px;
        }
        .welcome {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 30px;
          border-radius: 10px;
          margin-bottom: 30px;
        }
        .welcome h2 {
          font-size: 24px;
          margin-bottom: 10px;
        }
        .info-cards {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          margin-bottom: 30px;
        }
        .card {
          background: #f8f9fa;
          padding: 20px;
          border-radius: 10px;
          border-left: 4px solid #667eea;
        }
        .card h3 {
          color: #333;
          margin-bottom: 10px;
          font-size: 16px;
        }
        .card p {
          color: #666;
          font-size: 14px;
        }
        button {
          padding: 12px 30px;
          background: #e74c3c;
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          font-size: 16px;
          font-weight: 600;
          transition: all 0.3s;
        }
        button:hover {
          background: #c0392b;
          transform: translateY(-2px);
        }
        button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📊 Dashboard</h1>
          <div class="user-info">
            <div class="username">${req.session.username}</div>
            <div class="email">${req.session.email}</div>
          </div>
        </div>
        
        <div class="welcome">
          <h2>Welcome back, ${req.session.username}! 👋</h2>
          <p>You have successfully logged in to your account.</p>
        </div>
        
        <div class="info-cards">
          <div class="card">
            <h3>📁 Database</h3>
            <p>Connected to AWS RDS MySQL</p>
          </div>
          <div class="card">
            <h3>🔐 Security</h3>
            <p>Credentials stored in AWS Parameter Store</p>
          </div>
          <div class="card">
            <h3>☸️ Infrastructure</h3>
            <p>Running on Amazon EKS Cluster</p>
          </div>
          <div class="card">
            <h3>📊 Monitoring</h3>
            <p>Prometheus + Grafana metrics enabled</p>
          </div>
        </div>
        
        <button onclick="logout()" id="logoutBtn">🚪 Logout</button>
      </div>
      
      <script>
        async function logout() {
          const btn = document.getElementById('logoutBtn');
          btn.disabled = true;
          btn.textContent = 'Logging out...';
          
          try {
            const response = await fetch('/logout', { 
              method: 'POST',
              credentials: 'include'
            });
            
            if (response.ok) {
              window.location.replace('/');
            } else {
              alert('Logout failed. Redirecting anyway...');
              window.location.replace('/');
            }
          } catch (error) {
            console.error('Logout error:', error);
            window.location.replace('/');
          }
        }
      </script>
    </body>
    </html>
  `);
});

// Logout endpoint
app.post('/logout', (req, res) => {
  const username = req.session ? req.session.username : 'unknown';
  
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ message: 'Logout failed' });
    }
    
    activeUsers.dec();
    res.clearCookie('sessionId');
    console.log(`✅ User ${username} logged out successfully`);
    res.json({ message: 'Logged out successfully' });
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: pool ? 'connected' : 'disconnected'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).send('<h1>404 - Page Not Found</h1><p><a href="/">Go to Login</a></p>');
});

// Start server
initDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`✅ Health check available at /health`);
    console.log(`✅ Metrics available at /metrics`);
  });
}).catch(err => {
  console.error('❌ Failed to initialize database:', err);
  process.exit(1);
});
