const buildKey = (userId?: string | null) => (userId ? `user_selected_group_id:${userId}` : null);

export const loadSelectedGroupId = (userId?: string | null) => {
  const key = buildKey(userId);
  if (!key) return null;
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  const parsed = parseInt(raw, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

export const saveSelectedGroupId = (userId: string | null | undefined, groupId: number | null) => {
  const key = buildKey(userId);
  if (!key) return;
  if (groupId === null) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, groupId.toString());
};
