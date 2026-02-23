const PENDING_JOIN_GROUP_ID_KEY = 'pending_join_group_id';

export const savePendingJoinGroupId = (groupId: number) => {
  sessionStorage.setItem(PENDING_JOIN_GROUP_ID_KEY, String(groupId));
};

export const loadPendingJoinGroupId = (): number | null => {
  const raw = sessionStorage.getItem(PENDING_JOIN_GROUP_ID_KEY);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

export const clearPendingJoinGroupId = () => {
  sessionStorage.removeItem(PENDING_JOIN_GROUP_ID_KEY);
};
