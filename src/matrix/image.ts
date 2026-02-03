import { MatrixClient } from "matrix-bot-sdk";
import { config } from "../config.js";
import { logger } from "../utils/logger.js";

export interface MediaInfo {
  mxcUrl: string;
  mimeType: string;
  type: "image" | "video";
}

/**
 * Check if an event is an image or video message.
 */
export function isImageEvent(event: Record<string, unknown>): boolean {
  const content = event.content as Record<string, unknown> | undefined;
  return content?.msgtype === "m.image" || content?.msgtype === "m.video";
}

/**
 * Check if an event is a video message.
 */
export function isVideoEvent(event: Record<string, unknown>): boolean {
  const content = event.content as Record<string, unknown> | undefined;
  return content?.msgtype === "m.video";
}

/**
 * Extract media info from a Matrix event (image or video).
 */
export function getMediaInfoFromEvent(event: Record<string, unknown>): MediaInfo | null {
  const content = event.content as Record<string, unknown> | undefined;
  
  const msgtype = content?.msgtype;
  if (msgtype !== "m.image" && msgtype !== "m.video") {
    return null;
  }

  const url = content?.url as string | undefined;
  if (!url || !url.startsWith("mxc://")) {
    return null;
  }

  const info = content?.info as Record<string, unknown> | undefined;
  const mimeType = (info?.mimetype as string) || (msgtype === "m.video" ? "video/mp4" : "image/jpeg");
  const type = msgtype === "m.video" ? "video" : "image";

  return { mxcUrl: url, mimeType, type };
}

/**
 * Extract image info from a Matrix event (legacy, for compatibility).
 */
export function getImageInfoFromEvent(event: Record<string, unknown>): {
  mxcUrl: string;
  mimeType: string;
} | null {
  const mediaInfo = getMediaInfoFromEvent(event);
  if (!mediaInfo) return null;
  return { mxcUrl: mediaInfo.mxcUrl, mimeType: mediaInfo.mimeType };
}

/**
 * Convert MXC URL to HTTP URL.
 */
export function mxcToHttp(mxcUrl: string): string {
  // mxc://server/mediaId -> https://homeserver/_matrix/media/v3/download/server/mediaId
  const match = mxcUrl.match(/^mxc:\/\/([^/]+)\/(.+)$/);
  if (!match) {
    throw new Error(`Invalid MXC URL: ${mxcUrl}`);
  }

  const [, server, mediaId] = match;
  return `${config.matrix.homeserverUrl}/_matrix/media/v3/download/${server}/${mediaId}`;
}

/**
 * Download an image from Matrix and convert to base64 data URI.
 */
export async function downloadImageAsBase64(
  client: MatrixClient,
  mxcUrl: string,
  mimeType: string
): Promise<string> {
  const httpUrl = mxcToHttp(mxcUrl);

  logger.debug("Downloading image from Matrix", { mxcUrl, httpUrl });

  const response = await fetch(httpUrl, {
    headers: {
      Authorization: `Bearer ${config.matrix.accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  const dataUri = `data:${mimeType};base64,${base64}`;

  logger.debug("Image downloaded and converted to base64", {
    mxcUrl,
    size: arrayBuffer.byteLength,
    mimeType,
  });

  return dataUri;
}

/**
 * Fetch image from a Matrix event and return as base64 data URI.
 */
export async function fetchImageFromEvent(
  client: MatrixClient,
  event: Record<string, unknown>
): Promise<string | null> {
  const imageInfo = getImageInfoFromEvent(event);
  if (!imageInfo) {
    return null;
  }

  try {
    return await downloadImageAsBase64(client, imageInfo.mxcUrl, imageInfo.mimeType);
  } catch (error) {
    logger.error("Failed to fetch image from event", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export interface FetchedMedia {
  base64: string;
  type: "image" | "video";
  mimeType: string;
  size: number;
}

/**
 * Fetch media (image or video) from a Matrix event.
 * Returns base64 data URI along with media type info.
 */
export async function fetchMediaFromEvent(
  client: MatrixClient,
  event: Record<string, unknown>
): Promise<FetchedMedia | null> {
  const mediaInfo = getMediaInfoFromEvent(event);
  if (!mediaInfo) {
    return null;
  }

  try {
    const httpUrl = mxcToHttp(mediaInfo.mxcUrl);

    logger.debug("Downloading media from Matrix", { 
      mxcUrl: mediaInfo.mxcUrl, 
      httpUrl,
      type: mediaInfo.type 
    });

    const response = await fetch(httpUrl, {
      headers: {
        Authorization: `Bearer ${config.matrix.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download media: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const dataUri = `data:${mediaInfo.mimeType};base64,${base64}`;

    logger.debug("Media downloaded and converted to base64", {
      mxcUrl: mediaInfo.mxcUrl,
      size: arrayBuffer.byteLength,
      mimeType: mediaInfo.mimeType,
      type: mediaInfo.type,
    });

    return {
      base64: dataUri,
      type: mediaInfo.type,
      mimeType: mediaInfo.mimeType,
      size: arrayBuffer.byteLength,
    };
  } catch (error) {
    logger.error("Failed to fetch media from event", {
      error: error instanceof Error ? error.message : String(error),
      type: mediaInfo.type,
    });
    return null;
  }
}
