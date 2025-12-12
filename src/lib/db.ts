import Dexie, { type EntityTable } from 'dexie';

export interface IdolGroup {
  id: number; // manually assigned or synced from server
  name: string;
  themeColor: string;
  logoUrl?: string;
}

export interface UserMembership {
  id?: number;
  userId: string;
  groupId: number;
  points: number;
  totalPoints: number;
  currentRank?: string;
  selectedDesignId?: number;
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
}

export interface UserDesign {
  id?: number;
  userId: string;
  groupId: number; // Scoped to group
  designId: number;
  acquiredAt: number;
}

const db = new Dexie('CFPointCardDB') as Dexie & {
  pendingScans: EntityTable<PendingScan, 'id'>;
  userCache: EntityTable<UserCache, 'id'>;
  gifts: EntityTable<Gift, 'id'>;
  userTickets: EntityTable<UserTicket, 'id'>;
  rankConfigs: EntityTable<RankConfig, 'id'>;
  cardDesigns: EntityTable<CardDesign, 'id'>;
  userDesigns: EntityTable<UserDesign, 'id'>;
  groups: EntityTable<IdolGroup, 'id'>;
  userMemberships: EntityTable<UserMembership, 'id'>;
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
  await tx.table('userCache').toCollection().modify(async user => {
    if (user.points !== undefined) {
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
  });

  // Migrate other tables
  await tx.table('gifts').toCollection().modify(g => g.groupId = defaultGroupId);
  await tx.table('userTickets').toCollection().modify(t => t.groupId = defaultGroupId);
  await tx.table('rankConfigs').toCollection().modify(r => r.groupId = defaultGroupId);
  await tx.table('cardDesigns').toCollection().modify(d => d.groupId = defaultGroupId);
  await tx.table('userDesigns').toCollection().modify(d => d.groupId = defaultGroupId);
  await tx.table('pendingScans').toCollection().modify(s => s.groupId = defaultGroupId);
});

export { db };
