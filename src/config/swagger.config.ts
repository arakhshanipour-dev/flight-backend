import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Airline Agency Platform API')
    .setDescription(`
      ## API Documentation for Airline Agency Management System
      
      ### Features:
      - Multi-tenancy agency management
      - Ticket booking and invoicing
      - Payment processing
      - Support ticketing system
      - Role-based access control
      - Organization panels
      
      ### Authentication:
      Use the \`/auth/login\` endpoint to get a JWT token.
      Then click the "Authorize" button below and enter: \`Bearer YOUR_TOKEN\`
    `)
    .setVersion('1.0')
    .setContact('Support Team', 'https://yourapp.com', 'support@yourapp.com')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Authentication', 'Login, register, and token refresh')
    .addTag('Users', 'User management (requires authentication)')
    .addTag('Agencies', 'Agency management for support team')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      showRequestDuration: true,
    },
  });
}