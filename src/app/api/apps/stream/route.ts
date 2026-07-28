import { NextRequest } from "next/server";
import { createAppWithProgress } from "@/lib/appService";
import type { StorePlatform } from "@/lib/stores/types";

/** SSE progress feed for the "watch it happen" add-app flow - converts the
 * createAppWithProgress async generator into a stream of `data: {...}\n\n`
 * frames as each real step completes, matching the pattern Next.js's own
 * docs show for turning an async iterator into a Response body. */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const platform = body.platform as StorePlatform;
  const storeId = body.storeId as string;
  const country = (body.country as string) ?? "us";

  if (!platform || !storeId) {
    return new Response(JSON.stringify({ error: "platform and storeId are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: unknown) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }
      try {
        for await (const event of createAppWithProgress(platform, storeId, country)) {
          send(event);
        }
      } catch (e) {
        const message = (e as Error).message;
        send({
          stage: "error",
          message: message.includes("Unique constraint") ? "This app is already being tracked" : message,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
