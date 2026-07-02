const loopbackHosts = new Set(["localhost", "127.0.0.1"]);

export function enforceSameOriginMutation(request: Request) {
  const requestUrl = new URL(request.url);
  const expectedOrigin = requestUrl.origin;
  const origin = request.headers.get("origin");

  if (origin && origin !== expectedOrigin) {
    try {
      const actualOriginUrl = new URL(origin);
      const expectedOriginUrl = new URL(expectedOrigin);
      const actualHost = actualOriginUrl.hostname;
      const expectedHost = expectedOriginUrl.hostname;

      const bothLoopbackHosts = loopbackHosts.has(actualHost) && loopbackHosts.has(expectedHost);
      const samePort = actualOriginUrl.port === expectedOriginUrl.port;
      const sameProtocol = actualOriginUrl.protocol === expectedOriginUrl.protocol;

      if (!(bothLoopbackHosts && samePort && sameProtocol)) {
        return false;
      }
    } catch {
      return false;
    }
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && !["same-origin", "same-site", "none"].includes(fetchSite)) {
    return false;
  }

  return true;
}

export function isSecureRequest(request: Request) {
  const url = new URL(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const protocol = forwardedProto ? forwardedProto.split(",")[0].trim().toLowerCase() : url.protocol;
  return protocol === "https:";
}

export function buildNoStoreHeaders(extraHeaders?: HeadersInit) {
  return {
    "cache-control": "no-store, no-cache, must-revalidate, private",
    pragma: "no-cache",
    ...extraHeaders,
  };
}
