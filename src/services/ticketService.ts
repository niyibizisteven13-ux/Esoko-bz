import { apiGet, apiPut, apiPost } from './apiClient';

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'assigned' | 'in-progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
}

export const getTickets = async (options?: {
  status?: string;
  assignedTo?: string;
  limit?: number;
  offset?: number;
}) => {
  const params: any = {};
  if (options?.status) params.status = options.status;
  if (options?.assignedTo) params.assignedTo = options.assignedTo;
  if (options?.limit) params.limit = options.limit;
  if (options?.offset) params.offset = options.offset;
  return apiGet<{ tickets: Ticket[] }>('/api/tickets', { params });
};

export const createTicket = async (ticket: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt'>) => {
  return apiPost<{ id: string }>('/api/tickets', ticket);
};

export const updateTicket = async (id: string, updates: Partial<Ticket>) => {
  return apiPut(`/api/tickets/${id}`, updates);
};
