/* @flow */
import AWSSignersV4 from '../../util/aws/v4'
import { sha256 } from '../../util/crypto'
import fetch from '../../util/request'
import MailComposer from 'nodemailer/lib/mail-composer'
import qs from 'querystring'
// types
import type { EmailRequestType } from '../../models/notification-request'
import EmailMailgunProvider from './mailgun'

export default class EmailSesProvider {
  id: string = 'email-ses-provider'
  credentials: {
    region: string,
    accessKeyId: string,
    secretAccessKey: string,
    sessionToken: ?string
  }

  constructor ({ region, accessKeyId, secretAccessKey, sessionToken }: Object) {
    this.credentials = { region, accessKeyId, secretAccessKey, sessionToken }
  }

  async send (request: EmailRequestType): Promise<string> {
    if (
      request.text &&
      typeof request.text !== 'string' &&
      !(request.text instanceof Buffer) &&
      !(request.text instanceof Uint8Array)
    ) {
      throw new Error(
        'The "chunk" argument must be of type string or an instance of Buffer or Uint8Array.'
      )
    }

    const { region } = this.credentials
    const host = `email.${region}.amazonaws.com`
    const raw = (await this.getRaw(
      request.customize ? (await request.customize(this.id, request)) : request)
    ).toString('base64')
    console.log(raw);
    const body = qs.stringify({
      Action: 'SendRawEmail',
      Version: '2010-12-01',
      'RawMessage.Data': raw
    })
    const apiRequest = {
      method: 'POST',
      path: '/',
      headers: {
        Host: host,
        'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
        'X-Amz-Content-Sha256': sha256(body, 'hex'),
        'User-Agent': 'notifme-sdk/v1 (+https://github.com/notifme/notifme-sdk)'
      },
      body,
      region
    }
    const signer = new AWSSignersV4(apiRequest, 'ses')
    signer.addAuthorization(this.credentials, new Date())

    const response = await fetch(`https://${host}${apiRequest.path}`, apiRequest)

    const responseText = await response.text()
    if (response.ok && responseText.includes('<MessageId>')) {
      return responseText.match(/<MessageId>(.*)<\/MessageId>/)[1]
    } else {
      throw new Error(`${response.status} - ${responseText}`)
    }
  }

  async getRaw ({ customize, ...request }: EmailRequestType): Promise<Buffer> {
    const email = new MailComposer(request).compile()
    email.headers = {
      ...request.headers,
      'Return-Path': request.returnPath
    }
    email.keepBcc = true
    return email.build()
  }
}
