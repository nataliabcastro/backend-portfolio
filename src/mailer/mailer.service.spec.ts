import { Test, TestingModule } from '@nestjs/testing'
import { getQueueToken } from '@nestjs/bull'
import { ConfigService } from '@nestjs/config'
import * as fs from 'fs/promises'
import * as nodemailer from 'nodemailer'
import * as hbs from 'handlebars'

import { MailerService } from './mailer.service'
import { MailOptions } from './interfaces/mail-options.interface'

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn()
  })
}))

jest.mock('fs/promises', () => ({
  readFile: jest.fn()
}))

const mockMailQueue = {
  add: jest.fn()
}

const mockConfigService = {
  get: jest.fn().mockImplementation((key: string) => {
    const config: Record<string, string | number> = {
      MAIL_HOST: 'smtp.example.com',
      MAIL_PORT: 587,
      MAIL_USER: 'user@example.com',
      MAIL_PASS: 'secret',
      MAIL_FROM_ADDRESS: 'noreply@example.com',
      MAIL_FROM_NAME: 'App'
    }
    return config[key]
  })
}

// ─── Main suite ───────────────────────────────────────────────────────────────

describe('MailerService', () => {
  let service: MailerService
  let transporterSendMail: jest.Mock

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailerService,
        { provide: getQueueToken('mail'), useValue: mockMailQueue },
        { provide: ConfigService, useValue: mockConfigService }
      ]
    }).compile()

    service = module.get<MailerService>(MailerService)
    transporterSendMail = (nodemailer.createTransport as jest.Mock).mock
      .results[0].value.sendMail
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })

  // ─── sendMail ───────────────────────────────────────────────────────────────

  describe('sendMail', () => {
    const mailOptions: MailOptions = {
      to: 'recipient@example.com',
      subject: 'Welcome!',
      view: 'welcome',
      context: { name: 'Natalia' }
    }

    it('should add the job to the queue with the default options', async () => {
      // Act
      await service.sendMail(mailOptions)

      // Assert
      expect(mockMailQueue.add).toHaveBeenCalledTimes(1)
      expect(mockMailQueue.add).toHaveBeenCalledWith(
        'sendMail',
        mailOptions,
        expect.objectContaining({
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 }
        })
      )
    })

    it('should merge custom jobOptions with the default options', async () => {
      // Arrange
      const customJobOptions = { attempts: 5, delay: 1000 }

      // Act
      await service.sendMail(mailOptions, customJobOptions)

      // Assert
      expect(mockMailQueue.add).toHaveBeenCalledWith(
        'sendMail',
        mailOptions,
        expect.objectContaining({ attempts: 5, delay: 1000 })
      )
    })
  })

  // ─── sendMailFromQueue ──────────────────────────────────────────────────────

  describe('sendMailFromQueue', () => {
    const mailOptions: MailOptions = {
      to: 'recipient@example.com',
      subject: 'Welcome!',
      view: 'welcome',
      context: { name: 'Natalia' }
    }

    it('should render the template and send the email via transporter', async () => {
      // Arrange
      const templateContent = '<p>Hello, {{name}}!</p>'
      const expectedHtml = '<p>Hello, Natalia!</p>'
      ;(fs.readFile as jest.Mock).mockResolvedValue(
        Buffer.from(templateContent)
      )
      jest.spyOn(hbs, 'compile').mockReturnValue(() => expectedHtml)
      transporterSendMail.mockResolvedValue({})

      // Act
      await service.sendMailFromQueue(mailOptions)

      // Assert
      expect(fs.readFile).toHaveBeenCalledWith('src/mailer/views/welcome.hbs')
      expect(transporterSendMail).toHaveBeenCalledWith({
        to: mailOptions.to,
        subject: mailOptions.subject,
        html: expectedHtml
      })
    })

    it('should throw an error when the view file does not exist', async () => {
      // Arrange
      ;(fs.readFile as jest.Mock).mockRejectedValue(new Error('ENOENT'))

      // Act & Assert
      await expect(service.sendMailFromQueue(mailOptions)).rejects.toThrow(
        'The view src/mailer/views/welcome.hbs does not exist'
      )
    })
  })
})
