export type ViewDirection = 'NW' | 'NE' | 'SE' | 'SW';

async function apiPost<T>(endpoint: string, body: unknown): Promise<T> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function analyzeFloorPlan(
  base64Image: string,
  mimeType: string,
  direction: ViewDirection,
): Promise<string> {
  const { prompt } = await apiPost<{ prompt: string }>('/api/analyze', {
    base64Image,
    mimeType,
    direction,
  });
  return prompt;
}

export async function generate3DRendering(
  prompt: string,
  base64Image: string,
  mimeType: string,
): Promise<string> {
  const { imageData } = await apiPost<{ imageData: string }>('/api/render', {
    prompt,
    base64Image,
    mimeType,
  });
  return imageData;
}
