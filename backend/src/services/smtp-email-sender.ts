import * as nodemailer from 'nodemailer'
import type { SMTPConfig } from './app-config'
import type { EmailSendResult, EmailSender, SendEmailInput } from './email-sender'

export class SMTPEmailSender implements EmailSender {
  private readonly transporter

  constructor(config: SMTPConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user
        ? {
            user: config.user,
            pass: config.password,
          }
        : undefined,
    })
    this.config = config
  }

  private readonly config: SMTPConfig

  async send(input: SendEmailInput): Promise<EmailSendResult> {
    try {
      await this.transporter.sendMail({
        from: `"${this.config.fromName}" <${this.config.fromAddress}>`,
        to: input.recipientName
          ? `"${input.recipientName}" <${input.recipientEmail}>`
          : input.recipientEmail,
        subject: input.subject,
        text: input.text,
        html: input.html,
        attachments: input.attachments?.map((attachment) => ({
          filename: attachment.filename,
          content: attachment.contentBase64,
          encoding: 'base64' as const,
          contentType: attachment.contentType,
        })),
      })

      return {
        success: true,
        errorMessage: null,
      }
    } catch (error) {
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown SMTP delivery error.',
      }
    }
  }
}
