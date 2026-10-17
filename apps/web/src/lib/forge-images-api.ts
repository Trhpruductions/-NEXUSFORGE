import { api, authHeaders } from "./api";

export type ForgeImageKind = "icon" | "banner";

/** Sends a checked-and-cropped picture for a server's icon or banner. Returns the new URL. */
export async function uploadForgeImage(
  accessToken: string,
  csrfToken: string,
  forgeId: string,
  kind: ForgeImageKind,
  blob: Blob,
  onProgress?: (fraction: number) => void,
): Promise<string | null> {
  const response = await api.post<Partial<Record<ForgeImageKind, string | null>>>(`/api/forges/${forgeId}/${kind}`, blob, {
    headers: { ...authHeaders(accessToken, csrfToken), "Content-Type": blob.type },
    timeout: 120000,
    onUploadProgress: (event) => {
      if (onProgress && event.total) onProgress(Math.min(1, event.loaded / event.total));
    },
  });
  return response.data[kind] ?? null;
}

export async function removeForgeImage(accessToken: string, csrfToken: string, forgeId: string, kind: ForgeImageKind) {
  await api.delete(`/api/forges/${forgeId}/${kind}`, { headers: authHeaders(accessToken, csrfToken) });
}
