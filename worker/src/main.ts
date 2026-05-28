import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { ValidationPipe } from '@nestjs/common'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  })

  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://community-platform-app.vercel.app',
    ],
    credentials: true,
  })

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))

  // Escuchar en 0.0.0.0 es requerido por Fly.io
  // El puerto viene de la variable de entorno (Fly setea PORT=8080 por defecto)
  const port = parseInt(process.env.PORT ?? '8080')
  await app.listen(port, '0.0.0.0')
  console.log(`Worker corriendo en puerto ${port}`)
}

bootstrap()
