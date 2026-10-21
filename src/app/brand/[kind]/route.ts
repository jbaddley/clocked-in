import { emptyNotFound } from "@/lib/api/guid";
import { respond } from "@/lib/api/respond";
import { isBrandKind, isVercelBlobUrl } from "@/lib/brand";
import { encodePng, readBrandAsset, storedBrandUrl } from "@/lib/server/brand-assets";
import { getCurrentOrganization } from "@/lib/server/dal";

export async function GET(request: Request, context: { params: Promise<{ kind: string }> }) {
  return respond(async () => {
    const { kind } = await context.params;
    if (!isBrandKind(kind)) {
      return emptyNotFound();
    }

    const organization = await getCurrentOrganization();
    const storedUrl = organization ? storedBrandUrl(organization, kind) : null;
    if (!organization || !storedUrl) {
      return emptyNotFound();
    }

    if (storedUrl.startsWith("/") || (/^https?:\/\//i.test(storedUrl) && !isVercelBlobUrl(storedUrl))) {
      return Response.redirect(storedUrl, 302);
    }

    const result = await readBrandAsset(storedUrl);
    if (!result || result.statusCode !== 200 || !result.stream) {
      return emptyNotFound();
    }

    const cache = "private, max-age=0, must-revalidate";
    if (new URL(request.url).searchParams.get("format") === "png") {
      const png = await encodePng(result.stream);
      return new Response(new Uint8Array(png), {
        headers: { "Content-Type": "image/png", "Cache-Control": cache },
      });
    }

    return new Response(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType || "image/webp",
        "Cache-Control": cache,
      },
    });
  });
}
