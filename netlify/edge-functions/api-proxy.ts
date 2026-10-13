import type { Config } from "@netlify/edge-functions";

export default async function handler(req: Request) {
  const url = new URL(req.url);
  // Strip the /api prefix and forward the rest to the Arbeitsagentur API
  const apiPath = url.pathname.replace(/^\/api/, "");
  const targetUrl = `https://rest.arbeitsagentur.de${apiPath}${url.search}`;

  const headers = new Headers(req.headers);
  headers.set("X-API-Key", "jobboerse-jobsuche");
  // Remove host header so it doesn't conflict
  headers.delete("host");
  // Oversized cookies make the upstream Tomcat answer 400
  headers.delete("cookie");

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
    });

    // Forward the response back to the client
    const responseHeaders = new Headers(response.headers);
    responseHeaders.set("Access-Control-Allow-Origin", "*");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: "Proxy request failed", details: String(error) }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}

export const config: Config = {
  path: "/api/*",
};
