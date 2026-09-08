const express = require('express');
const session = require('express-session');
const path = require('path');
const amqp = require('amqplib');
const cors = require('cors');

const app = express();
const PORT = 3001;
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost';

let channel;

// In-Memory Order Storage (Persists during server runtime)
const ordersDB = [];

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session Configuration
app.use(session({
  secret: 'nexus_enterprise_secret_key',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 3600000 } // 1 hour session
}));

// Route: Serve Login Page
app.get('/login.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Authentication Guard Middleware
const requireAuth = (req, res, next) => {
  if (req.session && req.session.authenticated) {
    return next();
  }
  return res.redirect('/login.html');
};

// Route: Handle Login
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    req.session.authenticated = true;
    req.session.user = username;
    return res.json({ success: true, message: 'Authentication successful' });
  }
  return res.status(401).json({ success: false, message: 'Invalid credentials' });
});

// Route: Handle Logout
app.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/login.html');
  });
});

// Route: Fetch All Order History
app.get('/api/orders', requireAuth, (req, res) => {
  res.json(ordersDB);
});

// Route: Serve Protected Dashboard
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve Static Assets
app.use(express.static(path.join(__dirname, 'public')));

// RabbitMQ Queue Connection
async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(RABBITMQ_URL);
    channel = await connection.createChannel();
    await channel.assertQueue('order_created', { durable: true });
    console.log('Connected to RabbitMQ in Order Service');
  } catch (err) {
    console.error('RabbitMQ Connection Failed, retrying in 5s...', err.message);
    setTimeout(connectRabbitMQ, 5000);
  }
}
connectRabbitMQ();

// Route: Dispatch Order Event
app.post('/orders', requireAuth, async (req, res) => {
  const { customer, item, amount } = req.body;
  const order = {
    orderId: 'NEX-' + Math.floor(100000 + Math.random() * 900000),
    customer,
    item,
    amount: Number(amount),
    timestamp: new Date().toISOString()
  };

  // Push order into server memory
  ordersDB.push(order);

  if (channel) {
    channel.sendToQueue('order_created', Buffer.from(JSON.stringify(order)), { persistent: true });
    return res.status(201).json({ message: 'Event dispatched successfully', order });
  } else {
    return res.status(503).json({ error: 'RabbitMQ channel unavailable' });
  }
});

app.listen(PORT, () => {
  console.log(`Order Service running on port ${PORT}`);
});