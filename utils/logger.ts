export const logger = {
  log: (msg: string, ...args: any[]) => {
    if (process.server) {
      // Force to stdout for npm run dev console
      process.stdout.write(`${msg}\n`);
    } else {
      // Client-side
      console.log(msg, ...args);
    }
  },
  error: (msg: string, ...args: any[]) => {
    if (process.server) {
      // Force to stderr for npm run dev console
      process.stderr.write(`${msg}\n`);
    } else {
      // Client-side
      console.error(msg, ...args);
    }
  },
  debug: (msg: string, ...args: any[]) => {
    const isDev = process.env.NODE_ENV === 'development';
    if (!isDev) return;

    if (process.server) {
      // Force to stdout for npm run dev console
      process.stdout.write(`[DEBUG] ${msg}\n`);
    } else {
      // Client-side
      console.debug('[DEBUG]', msg, ...args);
    }
  }
};
