import { api, apiBlobRequest, apiRequest } from '../../services/api'

/**
 * Chat endpoints of the Core (Chat.Api). Direct and team threads are addressed by the other
 * user's / the team's id, so a thread can be opened before its conversation exists; the
 * conversation is created on the first message.
 */
export const chatCenterApi = {
  // Every active colleague of the caller's organization they may start a chat with.
  directory: () => api.get('/api/chat/direct/directory'),
  directUnread: () => api.get('/api/chat/direct/unread-counts'),
  directMessages: (userId, page = 1, pageSize = 500) =>
    api.get(`/api/chat/direct/${userId}/messages?page=${page}&pageSize=${pageSize}`),
  sendDirect: (userId, { text, file }) => apiRequest(`/api/chat/direct/${userId}/messages`, { method: 'POST', body: messageForm(text, file) }),
  markDirectRead: (userId) => api.post(`/api/chat/direct/${userId}/read`),

  // The caller's work teams; each one has one shared conversation.
  myTeams: () => api.get('/api/identity/groups/mine'),
  teamUnread: () => api.get('/api/chat/teams/unread-counts'),
  teamMessages: (teamId, page = 1, pageSize = 500) =>
    api.get(`/api/chat/teams/${teamId}/messages?page=${page}&pageSize=${pageSize}`),
  sendTeam: (teamId, { text, file }) => apiRequest(`/api/chat/teams/${teamId}/messages`, { method: 'POST', body: messageForm(text, file) }),
  markTeamRead: (teamId) => api.post(`/api/chat/teams/${teamId}/read`),

  // Conversation ids the caller takes part in: what the hub needs to deliver live messages.
  conversations: () => api.get('/api/chat/conversations/'),

  editMessage: (messageId, text) => api.put(`/api/chat/messages/${messageId}`, { text }),
  deleteMessage: (messageId) => api.delete(`/api/chat/messages/${messageId}`),
  attachment: (messageId) => apiBlobRequest(`/api/chat/messages/${messageId}/attachment`),
}

function messageForm(text, file) {
  const form = new FormData()
  form.append('text', text || '')
  if (file) form.append('file', file, file.name)
  return form
}
