import fs from 'fs';

export class DebugLogger {
  private logPath: string;
  constructor({ logPath }: { logPath: string }) {
    this.logPath = logPath;
  }

  public error(message: string, error?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ERROR: ${message}${
      error ? '\n' + (error.stack || JSON.stringify(error, null, 2)) : ''
    }\n`;
    fs.appendFileSync(this.logPath, logEntry);
  }

  public info(message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] INFO: ${message}${
      data ? '\n' + JSON.stringify(data, null, 2) : ''
    }\n`;
    fs.appendFileSync(this.logPath, logEntry);
  }
}
