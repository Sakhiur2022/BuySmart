export function createRouteParams<T extends Record<string, string>>(
  params: T,
): {
  params: Promise<T>;
} {
  return {
    params: Promise.resolve(params),
  };
}

export function createJsonRequest(
  url: string,
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE' = 'POST',
  body?: unknown,
): Request {
  return new Request(url, {
    method,
    headers: {
      'content-type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
