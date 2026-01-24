import Dexie, { type EntityTable } from 'dexie';

export interface IdolGroup {
  id: number; // manually assigned or synced from server
  name: string;
  themeColor: string;
  logoUrl?: string; // Add logoUrl to IdolGroup
  xUrl?: string;
  instagramUrl?: string;
  tiktokUrl?: string;
  youtubeUrl?: string;
  itunesUrl?: string;
  spotifyUrl?: string;
  websiteUrl?: string;
  transferEnabled?: boolean;
  profileCoverUrl?: string;
  profileDescription?: string;
  profileIsSolo?: boolean;
  deletedAt?: number | null;
}

export interface UserMembership {
  id?: number;
  userId: string;
  groupId: number;
  points: number;
  totalPoints: number;
  currentRank?: string;
  selectedDesignId?: number;
  memberId?: string;
  lastUpdated: number;
}

export interface PendingScan {
  id: number;
  userId: string;
  groupId: number; // Added groupId
  points: number;
  type: 'GRANT' | 'USE_TICKET' | 'GRANT_DESIGN';
  ticketId?: string; 
  designId?: number; 
  timestamp: number;
  synced: boolean;
}

export interface UserCache {
  id: string; 
  name?: string; // Keep name as global profile
  avatarUrl?: string; // Add avatarUrl
  // Points are now in UserMembership, but keep these for backward compatibility or "Default Group"
  points?: number;
  totalPoints?: number; 
  rank?: string;
  selectedDesignId?: number; 
  lastUpdated: number;
}

export interface Gift {
  id?: number;
  groupId: number; // Scoped to group
  name: string;
  pointsRequired: number;
  description?: string;
  stock?: number; 
  image?: string; 
  active: boolean;
}

export interface UserTicket {
  id?: number;
  userId: string; 
  groupId: number; // Scoped to group
  giftId: number; 
  giftName: string; 
  status: 'UNUSED' | 'USED';
  acquiredAt: number;
  usedAt?: number;
}

export interface RankConfig {
  id?: number;
  groupId: number; // Scoped to group
  name: string;
  minPoints: number;
  color: string; 
}

export interface CardDesign {
  id?: number;
  groupId: number; // Scoped to group
  name: string;
  imageUrl: string; 
  themeColor: string; 
  theme_color?: string; // For compatibility with Supabase
}

export interface UserDesign {
  id?: number;
  userId: string;
  groupId: number; // Scoped to group
  designId: number;
  acquiredAt: number;
}

export interface GroupMember {
  id?: number;
  groupId: number;
  name: string;
  role?: string;
  imageUrl?: string;
  sortOrder: number;
  createdAt: number;
}

export interface TransferRule {
  id?: number;
  targetGroupId: number;
  sourceGroupId: number | null;
  mode: 'FULL' | 'CAP';
  capPoints?: number | null;
  active: boolean;
}

export interface TransferCode {
  id?: number;
  code: string;
  userId: string;
  sourceGroupId: number;
  createdAt: number;
  usedAt?: number | null;
  usedByUserId?: string | null;
  usedTargetGroupId?: number | null;
}

export interface TransferLog {
  id?: number;
  fromGroupId: number;
  toGroupId: number;
  fromUserId: string;
  toUserId: string;
  pointsTransferred: number;
  createdAt: number;
}

// Use a new database name to force fresh start if v1 is corrupted
const db = new Dexie('CFPointCardDB_v2') as Dexie & {
  pendingScans: EntityTable<PendingScan, 'id'>;
  userCache: EntityTable<UserCache, 'id'>;
  gifts: EntityTable<Gift, 'id'>;
  userTickets: EntityTable<UserTicket, 'id'>;
  rankConfigs: EntityTable<RankConfig, 'id'>;
  cardDesigns: EntityTable<CardDesign, 'id'>;
  userDesigns: EntityTable<UserDesign, 'id'>;
  groupMembers: EntityTable<GroupMember, 'id'>;
  groups: EntityTable<IdolGroup, 'id'>;
  userMemberships: EntityTable<UserMembership, 'id'>;
  transferRules: EntityTable<TransferRule, 'id'>;
  transferCodes: EntityTable<TransferCode, 'id'>;
  transferLogs: EntityTable<TransferLog, 'id'>;
};

db.version(1).stores({
  pendingScans: '++id, userId, timestamp, synced',
  userCache: 'id'
});

db.version(2).stores({
  gifts: '++id, pointsRequired, active'
});

db.version(3).stores({
  userTickets: '++id, userId, status'
});

db.version(4).stores({
  rankConfigs: '++id, minPoints'
});

db.version(5).stores({
  userCache: 'id' 
}).upgrade(tx => {
  return tx.table('userCache').toCollection().modify(user => {
    if (user.totalPoints === undefined) {
        user.totalPoints = user.points;
    }
  });
});

db.version(6).stores({
  cardDesigns: '++id',
  userDesigns: '++id, userId, designId'
});

db.version(7).stores({
  userCache: 'id'
});

// Version 8: Multi-Group Support (Fixed: Retain userCache)
db.version(8).stores({
  userCache: 'id', // Retain for global profile (name, etc.)
  groups: 'id', // manual id
  userMemberships: '++id, [userId+groupId], userId, groupId',
  pendingScans: '++id, userId, groupId, timestamp, synced',
  gifts: '++id, groupId, pointsRequired, active',
  userTickets: '++id, userId, groupId, status',
  rankConfigs: '++id, groupId, minPoints',
  cardDesigns: '++id, groupId',
  userDesigns: '++id, userId, groupId, designId'
}).upgrade(async tx => {
  // Migration: Assign existing data to a default Group ID 1 ("Appare!")
  const defaultGroupId = 1;
  
  // Create default group
  await tx.table('groups').add({
    id: defaultGroupId,
    name: 'Default Idol',
    themeColor: '#2563EB'
  });

  // Migrate UserCache -> UserMembership
  // Use toArray() + loop instead of modify() with async callback to avoid Dexie/IndexedDB issues
  const users = await tx.table('userCache').toArray();
  for (const user of users) {
    if (user.points !== undefined) {
       // Check if already exists to be safe
       const existing = await tx.table('userMemberships').where({ userId: user.id, groupId: defaultGroupId }).first();
       if (!existing) {
         await tx.table('userMemberships').add({
           userId: user.id,
           groupId: defaultGroupId,
           points: user.points,
           totalPoints: user.totalPoints || user.points,
           currentRank: user.rank,
           selectedDesignId: user.selectedDesignId,
           lastUpdated: Date.now()
         });
       }
    }
  }

  // Migrate other tables
  await tx.table('gifts').toCollection().modify(g => g.groupId = defaultGroupId);
  await tx.table('userTickets').toCollection().modify(t => t.groupId = defaultGroupId);
  await tx.table('rankConfigs').toCollection().modify(r => r.groupId = defaultGroupId);
  await tx.table('cardDesigns').toCollection().modify(d => d.groupId = defaultGroupId);
  await tx.table('userDesigns').toCollection().modify(d => d.groupId = defaultGroupId);
  await tx.table('pendingScans').toCollection().modify(s => s.groupId = defaultGroupId);
});

// Version 9: Transfer system
db.version(9).stores({
  transferRules: '++id, targetGroupId, sourceGroupId, active',
  transferCodes: '++id, code, userId, sourceGroupId, createdAt, usedAt',
  transferLogs: '++id, fromGroupId, toGroupId, fromUserId, createdAt'
});

// Version 10: Group profile
db.version(10).stores({
  groupMembers: '++id, groupId, sortOrder'
});

// Export event name
export const DB_ERROR_EVENT = 'CF_POINT_CARD_DB_ERROR';

// Try to open safely
db.open().catch(async err => {
    console.error(`Failed to open db: ${err.stack || err}`);
    
    // Dispatch error event for UI handling
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(DB_ERROR_EVENT, { detail: err }));
    }

    if (err.name === 'UnknownError' || err.name === 'VersionError' || err.name === 'DatabaseClosedError') {
       const RETRY_KEY = 'db_retry_count';
       const retries = parseInt(sessionStorage.getItem(RETRY_KEY) || '0');
       
       if (retries < 2) { // Try twice
           console.warn(`Database error detected. Attempting recovery by deleting database... (Attempt ${retries + 1})`);
           sessionStorage.setItem(RETRY_KEY, (retries + 1).toString());
           try {
             // Important: Close the current instance before deleting, otherwise it might block deletion
             db.close(); 
             await Dexie.delete('CFPointCardDB_v2');
             window.location.reload();
           } catch (e) {
             console.error('Failed to delete database', e);
           }
       } else {
           console.error("Critical DB Error: Failed to recover after multiple attempts.");
           // Optional: Show UI feedback here or let the app handle empty DB state
       }
    } else {
        // Clear retry count on other errors or success (logic here assumes open failure is the main issue)
        sessionStorage.removeItem('db_retry_count'); 
    }
});

export { db };
