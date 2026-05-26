export interface SendEmailInput {
  recipientEmail: string
  recipientName: string
  subject: string
  text: string
  html: string
  attachments?: Array<{
    filename: string
    contentBase64: string
    contentType: string
  }>
}

export interface EmailSendResult {
  success: boolean
  errorMessage: string | null
}

export interface EmailSender {
  send(input: SendEmailInput): Promise<EmailSendResult>
}

export class StubEmailSender implements EmailSender {
  async send(input: SendEmailInput): Promise<EmailSendResult> {
    if (!input.recipientEmail.trim()) {
      return {
        success: false,
        errorMessage: 'Recipient email is empty.',
      }
    }

    if (!input.recipientEmail.includes('@')) {
      return {
        success: false,
        errorMessage: `Invalid email address for "${input.subject}".`,
      }
    }

    return {
      success: true,
      errorMessage: null,
    }
  }
}
