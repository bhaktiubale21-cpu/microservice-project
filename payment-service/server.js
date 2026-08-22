const amqp = require('amqplib');

async function startPaymentService() {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672');
    const channel = await connection.createChannel();
    
    await channel.assertQueue('order_created');
    await channel.assertQueue('payment_processed');

    console.log('💳 Payment Service listening for order_created events...');

    channel.consume('order_created', (msg) => {
      if (msg !== null) {
        const order = JSON.parse(msg.content.toString());
        console.log(`[Payment] Processing payment for Order ID: ${order.orderId} (Amount: $${order.amount})`);

        // Simulate payment processing
        const paymentResult = {
          orderId: order.orderId,
          customer: order.customer,
          status: 'SUCCESS',
          paidAt: new Date()
        };

        // Publish to payment_processed queue
        channel.sendToQueue('payment_processed', Buffer.from(JSON.stringify(paymentResult)));
        console.log(`[Payment] Payment SUCCESS for Order ID: ${order.orderId}`);

        channel.ack(msg); // Acknowledge message handled
      }
    });
  } catch (error) {
    console.error('Payment Service Error:', error);
    setTimeout(startPaymentService, 5000);
  }
}

startPaymentService();