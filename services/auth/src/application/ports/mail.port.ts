export interface SendMailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export const MAIL_PORT = Symbol('MAIL_PORT');

export interface MailPort {
  send(input: SendMailInput): Promise<void>;
}
