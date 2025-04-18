/** Google Cloud Service Account Credentials interface */
interface Credentials {
  /** Type of service account */
  type: string;
  /** Google Cloud project ID */
  project_id: string;
  /** Private key ID */
  private_key_id: string;
  /** Private key in PEM format */
  private_key: string;
  /** Service account email */
  client_email: string;
  /** OAuth2 client ID */
  client_id: string;
  /** OAuth2 auth URI */
  auth_uri: string;
  /** OAuth2 token URI */
  token_uri: string;
  /** Auth provider certificate URL */
  auth_provider_x509_cert_url: string;
  /** Client certificate URL */
  client_x509_cert_url: string;
  /** Universe domain for the service */
  universe_domain: string;
}

/** Configuration interface for SMTPGmailProxy */
interface SMTPGmailProxyConfig {
  /** Name of the proxy instance */
  name: string;
  /** Google Cloud Service Account Credentials */
  credentials: Credentials;
  /** Maximum number of retries for sending emails. Default: 3 */
  maxSendRetries?: number;
  /** Enable logging functionality. Default: true */
  enableLogs?: boolean;
  /** Enable POP3 server mocking. Default: true */
  enablePOP3Mocking?: boolean;
  /** Port for SMTP server. Default: 2525 */
  smtpPort?: number;
  /** Port for POP3 server. Default: 1100 */
  pop3Port?: number;
}
