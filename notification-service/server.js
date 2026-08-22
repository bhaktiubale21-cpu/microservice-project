const amqp = require('amqplib');

async function startNotificationService() {
  try {
    const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672');
    const channel = await connection.createChannel();

    await channel.assertQueue('payment_processed');

    console.log('📧 Notification Service listening for payment_processed events...');

    channel.consume('payment_processed', (msg) => {
      if (msg !== null) {
        const payment = JSON.parse(msg.content.toString());
        console.log(`[Notification] Email sent to ${payment.customer}: Order ${payment.orderId} successfully paid!`);
        channel.ack(msg);
      }
    });
  } catch (error) {
    console.error('Notification Service Error:', error);
    setTimeout(startNotificationService, 5000);
  }
}

startNotificationService();