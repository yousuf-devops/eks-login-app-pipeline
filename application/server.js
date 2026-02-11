const express = require('express');
const mysql = require('mysql2/promise');
const session = require('express-session');
const bodyParser = require('body-parser');
const fs = require('fs');

const app = express();
const PORT = 3000;

let pool;

// Read database credentials from files (written by init container)
const DB_HOST = fs.readFileSync(process.env.DB_HOST || '/secrets/DB_HOST', 'utf8').trim();
const DB_NAME = fs.readFileSync(process.env.DB_NAME || '/secrets/DB_NAME', 'utf8').trim();
const DB_USER = fs.readFileSync(process.env.DB_USER || '/secrets/DB_USER', 'utf8').trim();
const DB_PASSWORD = fs.readFileSync(process.env.DB_PASSWORD || '/secrets/DB_PASSWORD', 'utf8').trim();

console.log(`Connecting to database: ${DB_HOST}`);

// Create MySQL connection pool
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

// Test database connection
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

// Middleware
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

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
  if (req.session.userId) {
    return next();
  }
  res.redirect('/');
}

// Routes
app.get('/', (req, res) => {
  if (req.session.userId) {
    return res.redirect('/dashboard');
  }

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Login</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
        }
        .container {
          background: white;
          padding: 40px;
          border-radius: 10px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.2);
          width: 100%;
          max-width: 400px;
        }
        h1 {
          color: #333;
          margin-bottom: 30px;
          text-align: center;
        }
        .form-group {
          margin-bottom: 20px;
        }
        label {
          display: block;
          margin-bottom: 8px;
          color: #555;
          font-weight: 500;
        }
        input {
          width: 100%;
          padding: 12px;
          border: 2px solid #ddd;
          border-radius: 5px;
          font-size: 16px;
          transition: border-color 0.3s;
        }
        input:focus {
          outline: none;
          border-color: #667eea;
        }
        button {
          width: 100%;
          padding: 12px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 5px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s;
        }
        button:hover {
          transform: translateY(-2px);
        }
        .message {
          margin-top: 20px;
          padding: 12px;
          border-radius: 5px;
          text-align: center;
          display: none;
        }
        .error {
          background: #fee;
          color: #c33;
          border: 1px solid #fcc;
        }
        .success {
          background: #efe;
          color: #3c3;
          border: 1px solid #cfc;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🔐 Login</h1>
        <form id="loginForm">
          <div class="form-group">
            <label for="username">Username</label>
            <input type="text" id="username" name="username" required>
          </div>
          <div class="form-group">
            <label for="password">Password</label>
            <input type="password" id="password" name="password" required>
          </div>
          <button type="submit">Sign In</button>
        </form>
        <div id="message" class="message"></div>
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
              messageDiv.textContent = data.message;
              messageDiv.style.display = 'block';
              setTimeout(() => {
                window.location.href = '/dashboard';
              }, 1000);
            } else {
              messageDiv.className = 'message error';
              messageDiv.textContent = data.message;
              messageDiv.style.display = 'block';
            }
          } catch (error) {
            messageDiv.className = 'message error';
            messageDiv.textContent = 'An error occurred. Please try again.';
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
    return res.status(400).json({ message: 'Username and password are required' });
  }

  try {
    const [rows] = await pool.execute(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

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
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Dashboard</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          min-height: 100vh;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 20px;
        }
        .container {
          background: white;
          padding: 40px;
          border-radius: 10px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.2);
          width: 100%;
          max-width: 500px;
        }
        h1 {
          color: #333;
          margin-bottom: 20px;
          text-align: center;
        }
        .user-info {
          background: #f5f5f5;
          padding: 20px;
          border-radius: 5px;
          margin-bottom: 20px;
        }
        .user-info p {
          margin: 10px 0;
          color: #555;
        }
        .user-info strong {
          color: #333;
        }
        button {
          width: 100%;
          padding: 12px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          border-radius: 5px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s;
        }
        button:hover {
          transform: translateY(-2px);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>✅ Dashboard</h1>
        <div class="user-info">
          <p><strong>Welcome:</strong> ${req.session.username}</p>
          <p><strong>Email:</strong> ${req.session.email}</p>
          <p><strong>User ID:</strong> ${req.session.userId}</p>
        </div>
        <button onclick="logout()">Logout</button>
      </div>

      <script>
        async function logout() {
          try {
            const response = await fetch('/logout', {
              method: 'POST'
            });
            
            if (response.ok) {
              window.location.href = '/';
            }
          } catch (error) {
            console.error('Logout error:', error);
          }
        }
      </script>
    </body>
    </html>
  `);
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
