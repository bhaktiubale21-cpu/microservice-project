const express = require('express');
const amqp = require('amqplib');
const cors = require('cors');
const path = require('path'); // <-- Added missing path module

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());

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

app.post('/orders', async (req, res) => {
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