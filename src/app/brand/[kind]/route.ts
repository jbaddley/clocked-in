import { emptyNotFound } from "@/lib/api/guid";
import { respond } from "@/lib/api/respond";
import { isBrandKind, isVercelBlobUrl } from "@/lib/brand";
import { readBrandAsset, storedBrandUrl } from "@/lib/server/brand-assets";
import { getCurrentOrganization } from "@/lib/server/dal";

export async function GET(_request: Request, context: { params: Promise<{ kind: string }> }) {
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

    if (/^https?:\/\//i.test(storedUrl) && !isVercelBlobUrl(storedUrl)) {
      return Response.redirect(storedUrl, 302);
    }

    const result = await readBrandAsset(storedUrl);
    if (!result || result.statusCode !== 200 || !result.stream) {
      return emptyNotFound();
    }

    return new Response(result.stream, {
      headers: {
        "Content-Type": result.blob.contentType || "image/webp",
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  });
}
