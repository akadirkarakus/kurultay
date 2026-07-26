import { request, requestFormData } from "@/lib/client/http";
import type { AdminAccount, AdminCharacter, AdminScenario } from "@/types/admin";

export const adminApi = {
  login: (username: string, password: string) =>
    request<{ username: string; isSuperAdmin: boolean }>("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<{ ok: true }>("/api/admin/logout", { method: "POST" }),

  listCharacters: (includeArchived: boolean) =>
    request<{ characters: AdminCharacter[] }>(
      `/api/admin/characters${includeArchived ? "?includeArchived=true" : ""}`,
    ),
  createCharacter: (formData: FormData) =>
    requestFormData<{ character: AdminCharacter }>("/api/admin/characters", formData),
  updateCharacter: (
    id: string,
    body: { name?: string; category?: string; attributes?: Record<string, number> },
  ) =>
    request<{ character: AdminCharacter }>(`/api/admin/characters/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  uploadCharacterImage: (id: string, image: File) => {
    const formData = new FormData();
    formData.append("image", image);
    return requestFormData<{ character: AdminCharacter }>(`/api/admin/characters/${id}/image`, formData);
  },
  archiveCharacter: (id: string) =>
    request<{ character: AdminCharacter }>(`/api/admin/characters/${id}/archive`, { method: "POST" }),
  unarchiveCharacter: (id: string) =>
    request<{ character: AdminCharacter }>(`/api/admin/characters/${id}/unarchive`, { method: "POST" }),

  listScenarios: () => request<{ scenarios: AdminScenario[] }>("/api/admin/scenarios"),
  createScenario: (body: { text: string; suggestedAttributes: string[] }) =>
    request<{ scenario: AdminScenario }>("/api/admin/scenarios", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateScenario: (id: string, body: { text: string; suggestedAttributes: string[] }) =>
    request<{ scenario: AdminScenario }>(`/api/admin/scenarios/${id}`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteScenario: (id: string) => request<{ ok: true }>(`/api/admin/scenarios/${id}`, { method: "DELETE" }),

  listAdmins: () => request<{ admins: AdminAccount[] }>("/api/admin/admins"),
  createAdmin: (body: { username: string; password: string; isSuperAdmin: boolean }) =>
    request<{ admin: AdminAccount }>("/api/admin/admins", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  deleteAdmin: (id: string) => request<{ ok: true }>(`/api/admin/admins/${id}`, { method: "DELETE" }),
};
