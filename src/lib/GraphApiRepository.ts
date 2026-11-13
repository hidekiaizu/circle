import type { GraphData, Person, PersonAttributes, Relationship } from "./types";

async function request<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, body === undefined ? { cache: "no-store" } : {
    method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  if (response.status === 401 || response.status === 403) {
    window.location.replace("/");
    throw new Error("Please sign in again.");
  }
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(result?.error ?? "Could not save Circle.");
  return result as T;
}

export class GraphApiRepository {
  load(): Promise<GraphData> { return request<GraphData>("/api/graph"); }
  insertPerson(person: Person): Promise<void> { return request<void>("/api/graph", { action: "addPerson", person }); }
  insertConnectedPerson(person: Person, relationship: Relationship): Promise<void> {
    return request<void>("/api/graph", { action: "addConnectedPerson", person, relationship });
  }
  updatePerson(id: string, patch: Partial<PersonAttributes> & { name?: string; claimed?: boolean }): Promise<void> {
    return request<void>("/api/graph", { action: "updatePerson", id, patch });
  }
  deletePerson(id: string): Promise<void> { return request<void>("/api/graph", { action: "deletePerson", id }); }
  insertRelationship(relationship: Relationship): Promise<void> { return request<void>("/api/graph", { action: "insertRelationship", relationship }); }
  updateRelationship(id: string, patch: { category?: number; confirmed?: boolean }): Promise<void> {
    return request<void>("/api/graph", { action: "updateRelationship", id, patch });
  }
  deleteRelationship(id: string): Promise<void> { return request<void>("/api/graph", { action: "deleteRelationship", id }); }
}
