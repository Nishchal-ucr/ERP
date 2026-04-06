import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { config as dotenvConfig } from 'dotenv';
import { AppModule } from '@/src/app.module';
import { SeedService } from '@/src/seed/seed.service';

dotenvConfig();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());

  const config = new DocumentBuilder()
    .setTitle('Flygoog Reporting API')
    .setDescription('API documentation for Flygoog reporting service')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        in: 'header',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Enable CORS
  app.enableCors({
    // TODO: Allow only from specific ip addresses
    origin: '*',
    credentials: true,
  });

  // Run database seeding
  const seedService = app.get(SeedService);
  await seedService.seed();

  const port = Number(process.env.PORT) || 8000;
  await app.listen(port);
}
bootstrap();
