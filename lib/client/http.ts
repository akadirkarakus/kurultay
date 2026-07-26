export class ApiClientError extends Error {
  constructor(
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiClientError(body?.error ?? `Request failed (${res.status})`, body?.code);
  }
  return body as T;
}

/**
 * Same as `request`, but for a `FormData` body (file uploads) — the browser
 * must set its own `Content-Type: multipart/form-data; boundary=...` header,
 * so this deliberately does not force a JSON content-type.
 */
export async function requestFormData<T>(
  url: string,
  formData: FormData,
  options?: Omit<RequestInit, "body">,
): Promise<T> {
  const res = await fetch(url, { method: "POST", ...options, body: formData });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiClientError(body?.error ?? `Request failed (${res.status})`, body?.code);
  }
  return body as T;
}
