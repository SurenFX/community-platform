import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ValidationPipe } from '@nestjs/common'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  })

  // Aceptar requests solo desde Next.js y el bot interno
  app.enableCors({
    origin: [
      'http://localhost:3000',
      process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
    ],
    credentials: true,
  })

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))

  const port = process.env.PORT ?? 3001
  await app.listen(port)
  console.log(`Worker corriendo en http://localhost:${port}`)
}

bootstrap()
