import { authRequest } from "@/lib/auth/client";
/* eslint-disable @typescript-eslint/no-explicit-any */

export type CrmContact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  source: string;
  status: string;
  totalPurchases: number;
  totalSpent: number;
  totalTickets: number;
  lastPurchaseAt: string | null;
  tags?: Array<{ tag: CrmTag }>;
};
export type CrmTag = {
  id: string;
  name: string;
  color?: string;
  description?: string;
  _count?: { contacts: number };
};
export type Segment = {
  id: string;
  name: string;
  description?: string;
  type: string;
  rules: Record<string, unknown>;
  contactCount: number;
  lastCalculatedAt?: string;
};
export type Communication = {
  id: string;
  channel: string;
  subject?: string;
  content: string;
  status: string;
  scheduledAt: string;
  createdAt: string;
  destinationMasked: string;
  failureReason?: string;
  contact: { name: string };
  metadata?: Record<string, unknown>;
};
export type MessageTemplate = {
  id: string;
  name: string;
  channel: string;
  category: string;
  subject?: string;
  content: string;
  isSystemTemplate: boolean;
};
export type AbandonedReservation = {
  id: string;
  buyerId: string;
  contactId: string | null;
  buyer: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  campaign: { id: string; title: string; slug: string };
  quantity: number;
  amount: number;
  reservedAt: string;
  expiresAt: string;
  abandonedAt: string;
  paymentMethod: string | null;
  recoveryAttempts: number;
  lastCommunication: string | null;
  contactStatus: string;
  failureReason: string | null;
};
export type AbandonedReservationsResult = {
  items: AbandonedReservation[];
  total: number;
  pages: number;
  page: number;
  summary: {
    total: number;
    uniqueBuyers: number;
    potentialValue: number;
    totalTickets: number;
    recoveryRate: number | null;
  };
};
export type CrmDashboard = {
  total: number;
  leads: number;
  customers: number;
  vip: number;
  inactive: number;
  totalSpent: number;
  averageSpent: number;
  pendingPayments: number;
  abandoned: number;
  segments: number;
  automations: number;
  pausedAutomations: number;
  tasks: number;
  tasksInProgress: number;
  overdueTasks: number;
  completedToday: number;
  cities: Array<{
    city: string | null;
    _count: number;
    _sum: { totalSpent: number | string | null };
    _avg: { totalSpent: number | string | null };
  }>;
  sources: Array<{ source: string; _count: number }>;
};

export const dashboard = () =>
  authRequest<CrmDashboard>("/api/crm/dashboard", {
    cache: "no-store",
  });
export const contacts = (query = "") =>
  authRequest<{
    items: CrmContact[];
    total: number;
    pages: number;
    page: number;
  }>(`/api/crm/contacts${query}`, { cache: "no-store" });
export const contact = (id: string) =>
  authRequest<any>(`/api/crm/contacts/${id}`, { cache: "no-store" });
export const setContactStatus = (id: string, status: string) =>
  authRequest(`/api/crm/contacts/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
export const addNote = (id: string, content: string) =>
  authRequest(`/api/crm/contacts/${id}/notes`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
export const addContactTag = (id: string, tagId: string) =>
  authRequest(`/api/crm/contacts/${id}/tags/${tagId}`, { method: "POST" });
export const removeContactTag = (id: string, tagId: string) =>
  authRequest(`/api/crm/contacts/${id}/tags/${tagId}`, { method: "DELETE" });

export const tags = () =>
  authRequest<CrmTag[]>("/api/crm/tags", { cache: "no-store" });
export const createTag = (body: Partial<CrmTag>) =>
  authRequest<CrmTag>("/api/crm/tags", {
    method: "POST",
    body: JSON.stringify(body),
  });
export const updateTag = (id: string, body: Partial<CrmTag>) =>
  authRequest<CrmTag>(`/api/crm/tags/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
export const deleteTag = (id: string) =>
  authRequest(`/api/crm/tags/${id}`, { method: "DELETE" });

export const segments = () =>
  authRequest<Segment[]>("/api/crm/segments", { cache: "no-store" });
export const createSegment = (body: unknown) =>
  authRequest<Segment>("/api/crm/segments", {
    method: "POST",
    body: JSON.stringify(body),
  });
export const previewSegment = (body: unknown) =>
  authRequest<{ count: number }>("/api/crm/segments/preview", {
    method: "POST",
    body: JSON.stringify(body),
  });
export const updateSegment = (id: string, body: unknown) =>
  authRequest<Segment>(`/api/crm/segments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
export const calculateSegment = (id: string) =>
  authRequest<Segment>(`/api/crm/segments/${id}/calculate`, { method: "POST" });
export const deleteSegment = (id: string) =>
  authRequest(`/api/crm/segments/${id}`, { method: "DELETE" });
export const abandonedReservations = (query = "") =>
  authRequest<AbandonedReservationsResult>(
    `/api/crm/abandoned-reservations${query}`,
    { cache: "no-store" },
  );

export const tasks = () =>
  authRequest<any[]>("/api/crm/tasks", { cache: "no-store" });
export const createTask = (body: unknown) =>
  authRequest("/api/crm/tasks", { method: "POST", body: JSON.stringify(body) });
export const completeTask = (id: string) =>
  authRequest(`/api/crm/tasks/${id}/complete`, { method: "POST" });
export const updateTaskStatus = (id: string, status: string) =>
  authRequest(`/api/crm/tasks/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
export const automations = () =>
  authRequest<any[]>("/api/engagement/automations", { cache: "no-store" });
export const createAutomation = (body: unknown) =>
  authRequest("/api/engagement/automations", {
    method: "POST",
    body: JSON.stringify(body),
  });
export const setAutomationStatus = (id: string, status: string) =>
  authRequest(`/api/engagement/automations/${id}/${status}`, {
    method: "POST",
  });
export const testAutomation = (id: string) =>
  authRequest<any>(`/api/engagement/automations/${id}/test`, {
    method: "POST",
  });

export const notifications = () =>
  authRequest<any[]>("/api/engagement/notifications", { cache: "no-store" });
export const readNotification = (id: string) =>
  authRequest(`/api/engagement/notifications/${id}/read`, { method: "POST" });
export const readAllNotifications = () =>
  authRequest("/api/engagement/notifications/read-all", { method: "POST" });

export const templates = () =>
  authRequest<MessageTemplate[]>("/api/engagement/message-templates", {
    cache: "no-store",
  });
export const createTemplate = (body: unknown) =>
  authRequest<MessageTemplate>("/api/engagement/message-templates", {
    method: "POST",
    body: JSON.stringify(body),
  });
export const updateTemplate = (id: string, body: unknown) =>
  authRequest<MessageTemplate>(`/api/engagement/message-templates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
export const duplicateTemplate = (id: string) =>
  authRequest<MessageTemplate>(
    `/api/engagement/message-templates/${id}/duplicate`,
    { method: "POST" },
  );
export const deleteTemplate = (id: string) =>
  authRequest(`/api/engagement/message-templates/${id}`, { method: "DELETE" });
export const previewTemplate = (
  id: string,
  variables: Record<string, string>,
) =>
  authRequest<{ subject: string; content: string }>(
    `/api/engagement/message-templates/${id}/preview`,
    { method: "POST", body: JSON.stringify({ variables }) },
  );

export const communications = () =>
  authRequest<Communication[]>("/api/engagement/communications", {
    cache: "no-store",
  });
export const previewCommunication = (body: unknown) =>
  authRequest<{
    recipients: number;
    subject: string;
    content: string;
    variables: Record<string, string>;
  }>("/api/engagement/communications/preview", {
    method: "POST",
    body: JSON.stringify(body),
  });
export const createCommunication = (body: unknown) =>
  authRequest<{ message: string; recipients: number; status: string }>(
    "/api/engagement/communications",
    { method: "POST", body: JSON.stringify(body) },
  );
export const executeCommunication = (id: string) =>
  authRequest<{ message: string }>(
    `/api/engagement/communications/${id}/execute`,
    { method: "POST" },
  );
export const cancelCommunication = (id: string) =>
  authRequest(`/api/engagement/communications/${id}/cancel`, {
    method: "POST",
  });
