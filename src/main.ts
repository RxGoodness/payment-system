import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import compression = require('compression');
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  
  const configService = app.get(ConfigService);
  const isDevelopment = configService.get('NODE_ENV') === 'development';

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: isDevelopment ? false : undefined,
  }));

  // Compression
  app.use(compression());

  // Global validation pipe with enhanced options
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      disableErrorMessages: !isDevelopment,
      validationError: {
        target: false,
        value: false,
      },
    }),
  );

  // CORS configuration
  const corsOrigins = configService.get('CORS_ORIGIN')?.split(',') || ['http://localhost:3000'];
  app.enableCors({
    origin: isDevelopment ? true : corsOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });

  // API prefix
  app.setGlobalPrefix('api/v1', {
    exclude: ['/health', '/metrics'],
  });

  // Swagger Documentation (only in development)
  if (isDevelopment) {
    const config = new DocumentBuilder()
      .setTitle('Payment Processing System API')
      .setDescription(`
        Welcome to our Payment Processing System API documentation. This guide will help you integrate payments into your application using our secure and reliable payment infrastructure.

        ## What Can You Do With This API?
        This API allows you to accept payments from your customers through various channels including cards, bank transfers, and USSD. It provides real-time payment notifications and detailed transaction reporting.

        ## Key Features
        * Accept payments securely using Paystack's trusted payment gateway
        * Get instant notifications when payments succeed or fail
        * Manage multiple payment methods for your business
        * Track all your transactions in real-time
        * Enterprise-grade security with JWT authentication

        ## Quick Integration Guide
        1. Create your merchant account (/auth/register)
        2. Sign in to get your access token (/auth/login)
        3. Set up your preferred payment methods
        4. Start accepting payments from your customers
        5. Receive real-time updates via webhooks

        ## Need Help?
        * All endpoints are documented with example requests and responses
        * Each error response includes clear instructions on how to resolve it
        * Test your integration using our development environment
      `)
      .setVersion('1.0.0')
      .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      })
      .addServer('http://localhost:3000', 'Development server')
      .addServer('https://payment-system-d4sz.onrender.com', 'Production server')
      .addTag('Authentication', 'Merchant authentication and authorization')
      .addTag('Payments', 'Payment processing and management')
      .addTag('Payment Methods', 'Payment method management')
      .addTag('Merchants', 'Merchant profile management')
      .addTag('Webhooks', 'Paystack webhook handling')
      .addTag('Health', 'System health and monitoring')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        tagsSorter: 'alpha',
        operationsSorter: 'alpha',
      },
      customfavIcon: 'https://nestjs.com/img/logo-small.svg',
      customSiteTitle: 'Payment System API Docs',
    });
  }

  const port = configService.get('APP_PORT') || 3000;
  await app.listen(port, '0.0.0.0');
  
  logger.log(`🚀 Application is running on: http://localhost:${port}`);
  logger.log(`🌍 Environment: ${configService.get('NODE_ENV', 'development')}`);
  
  if (isDevelopment) {
    logger.log(`📖 API Documentation: http://localhost:${port}/api/docs`);
  }
  
  logger.log(`💳 Paystack Integration: ${configService.get('PAYSTACK_SECRET_KEY') ? 'Configured' : 'Not Configured'}`);
  logger.log(`🔗 SQS Queue: ${configService.get('AWS_SQS_QUEUE_URL') ? 'Configured' : 'Not Configured'}`);
  
  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.log('SIGTERM received, shutting down gracefully');
    await app.close();
    process.exit(0);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});
