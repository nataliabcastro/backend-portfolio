import { Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'

import { PrismaExceptionFilter } from '@shared/filters/prisma-exception.filter'

import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.useGlobalFilters(new PrismaExceptionFilter())
  app.enableCors()

  const configService = app.get(ConfigService)

  const name = configService.get<string>('APP_NAME')
  const mode = configService.get<string>('APP_MODE')
  const port = configService.get<string>('APP_PORT')

  const swaggerConfig = new DocumentBuilder()
    .setTitle(name || 'API')
    .setDescription('Documentação interativa da API')
    .setVersion('1.0')
    .addBearerAuth()
    .build()
  const document = SwaggerModule.createDocument(app, swaggerConfig)
  SwaggerModule.setup('docs', app, document)

  const logger = new Logger(name)

  await app.listen(port, () => {
    logger.log(`Application running on ${mode} mode`)
  })
}

bootstrap()
