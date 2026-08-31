const express = require('express');
const amqp = require('amqplib');
const cors = require('cors');
const path = require('path');
const session = require('express-session');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Configure Session Support
app.use(session({
  secret: 'nexus-secret-key-2026',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Set to true if serving over HTTPS
}));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

let channel;

async function connectRabbitMQ() {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672');
    channel = await connection.createChannel();
    await channel.assertQueue('order_created');
    console.log(' Connected to RabbitMQ in Order Service');
  } catch (error) {
    console.error('RabbitMQ connection error:', error);
    setTimeout(connectRabbitMQ, 5000);
  }
}

connectRabbitMQ();

// Auth Middleware to protect dashboard routes
function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) {
    return next();
  }
  return res.redirect('/login.html');
}

// Authentication API Route
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  
  // Default demo credentials: admin / admin123
  if (username === 'admin' && password === 'admin123') {
    req.session.authenticated = true;
    req.session.user = username;
    return res.json({ success: true });
  } else {
    return res.status(401).json({ success: false, message: 'Invalid username or password' });
  }
});

// Logout Route
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login.html');
});

// Protect Main Operations Hub Route
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Post Orders API (Protected)
app.post('/orders', requireAuth, async (req, res) => {
  const { customer, item, amount } = req.body;
  const order = {
    orderId: 'ORD-' + Math.floor(1000 + Math.random() * 9000),
    customer,
    item,
    amount,
    status: 'CREATED',
    timestamp: new Date()
  };

  if (channel) {
    channel.sendToQueue('order_created', Buffer.from(JSON.stringify(order)));
    console.log(' Published Order Event:', order);
    return res.status(201).json({ message: 'Order created successfully!', order });
  } else {
    return res.status(500).json({ error: 'RabbitMQ connection not ready' });
  }
});

app.listen(3001, () => console.log('Order Service running on port 3001'));