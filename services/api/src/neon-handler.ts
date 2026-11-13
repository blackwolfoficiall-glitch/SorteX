import { createApplication } from './application';

// Hosting adapter only: every request still runs through the original Nest app,
// guards, validation, raw webhook parser, services and Prisma client.
let origin: Promise<string> | undefined;
function applicationOrigin() {
  if (!origin) {
    origin = (async () => {
      const app = await createApplication();
      app.enableShutdownHooks();
      await app.listen(0, '127.0.0.1');
      return app.getUrl();
    })().catch((error: unknown) => {
      origin = undefined;
      throw error;
    });
  }
  return origin;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const localOrigin = await applicationOrigin();
    const incoming = new URL(request.url);
    const target = new URL(localOrigin);
    target.pathname = incoming.pathname;
    target.search = incoming.search;
    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('connection');
    headers.delete('content-length');
    headers.delete('transfer-encoding');
    const response = await fetch(target, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method)
        ? undefined
        : await request.arrayBuffer(),
      redirect: 'manual',
    });
    const outputHeaders = new Headers(response.headers);
    outputHeaders.delete('connection');
    outputHeaders.delete('transfer-encoding');
    outputHeaders.delete('content-length');
    outputHeaders.delete('content-encoding');
    return new Response(response.body, {
      status: response.status,
      headers: outputHeaders,
    });
  },
};
