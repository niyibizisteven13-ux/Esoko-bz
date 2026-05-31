import { apiGet, apiPost } from './apiClient';

export interface TeamInvitePayload {
  traderId: string;
  name: string;
  email: string;
  role: string;
  branchName?: string;
  branchLocation?: string;
  permissions: string[];
}

export async function inviteTeamMember(payload: TeamInvitePayload) {
  return apiPost<any>('/api/traders/team/invitations', payload);
}

export async function getTraderTeam(traderId: string) {
  return apiGet<any>('/api/traders/team/members', { params: { traderId } });
}

export async function getTeamInvitation(token: string) {
  return apiGet<any>(`/api/team/invitations/${encodeURIComponent(token)}`);
}

export async function acceptTeamInvitation(
  token: string,
  payload: {
    phone?: string;
    location?: string;
    nationalId?: string;
    password?: string;
    consentAccepted: boolean;
  }
) {
  return apiPost<any>(`/api/team/invitations/${encodeURIComponent(token)}/accept`, payload);
}

export async function denyTeamInvitation(token: string) {
  return apiPost<any>(`/api/team/invitations/${encodeURIComponent(token)}/deny`);
}

export async function getAccessOptions() {
  return apiGet<any>('/api/auth/access-options');
}

export async function selectAccess(payload: {
  mode: 'own' | 'account' | 'team';
  accountId?: string;
  role?: string;
  membershipId?: string;
}) {
  return apiPost<any>('/api/auth/select-access', payload);
}

export async function revokeTeamMember(memberId: string) {
  return apiPost<any>(`/api/traders/team/members/${encodeURIComponent(memberId)}/revoke`);
}
