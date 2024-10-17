/* @flow */
import nodemailer from 'nodemailer'
// Types
import type { EmailRequestType } from '../../models/notification-request'

export default class EmailSmtpProvider {
  id: string = 'email-smtp-provider'
  transporter: Object

  constructor (config: Object | string) {
    this.transporter = nodemailer.createTransport(config)
  }

  async send (request: EmailRequestType): Promise<string> {
    const { customize, ...rest } = request.customize ? (await request.customize(this.id, request)) : request
    const newHeaders = { 
      ...rest.headers, 
      'Return-Path': rest.returnPath
    }
    const newRest = {
      ...rest,
      'Return-Path': rest.returnPath,
      headers: newHeaders
    }
    console.log(newRest);
    const result = await this.transporter.sendMail(newRest)
    return result.messageId
  }
}
