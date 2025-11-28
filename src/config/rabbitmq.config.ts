import { registerAs } from '@nestjs/config';

export const rabbitmqConfig = registerAs('rabbitmq', () => ({
    url: process.env.RABBITMQ_URL || 'amqp://admin:admin@localhost:5672',
    exchange: process.env.RABBITMQ_EXCHANGE || 'multitenant_events',
    queuePrefix: process.env.RABBITMQ_QUEUE_PREFIX || 'nest_rbac',
}));
