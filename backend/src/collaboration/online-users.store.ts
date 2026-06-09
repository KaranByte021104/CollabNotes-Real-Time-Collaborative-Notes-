import { Injectable } from '@nestjs/common';

export interface OnlineUser {
  userId: string;
  name: string;
  socketId: string;
  color: string;
  avatarUrl?: string;
}

@Injectable()
export class OnlineUsersStore {
  // workspaceId -> Map<userId, OnlineUser>
  private readonly store = new Map<string, Map<string, OnlineUser>>();

  private generateColorFromName(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (let i = 0; i < 3; i++) {
      const value = (hash >> (i * 8)) & 0xff;
      color += ('05' + value.toString(16)).slice(-2); // ensure colors are somewhat visible/bright
    }
    return color;
  }

  addUser(workspaceId: string, userId: string, name: string, socketId: string, avatarUrl?: string): OnlineUser {
    if (!this.store.has(workspaceId)) {
      this.store.set(workspaceId, new Map());
    }

    const workspaceUsers = this.store.get(workspaceId)!;
    const color = this.generateColorFromName(name);

    const onlineUser: OnlineUser = {
      userId,
      name,
      socketId,
      color,
      avatarUrl,
    };

    workspaceUsers.set(userId, onlineUser);
    return onlineUser;
  }

  removeUser(workspaceId: string, userId: string): void {
    const workspaceUsers = this.store.get(workspaceId);
    if (workspaceUsers) {
      workspaceUsers.delete(userId);
      if (workspaceUsers.size === 0) {
        this.store.delete(workspaceId);
      }
    }
  }

  getUsers(workspaceId: string): OnlineUser[] {
    const workspaceUsers = this.store.get(workspaceId);
    if (!workspaceUsers) return [];
    return Array.from(workspaceUsers.values());
  }

  findUserBySocketId(socketId: string): { workspaceId: string; user: OnlineUser } | null {
    for (const [workspaceId, workspaceUsers] of this.store.entries()) {
      for (const user of workspaceUsers.values()) {
        if (user.socketId === socketId) {
          return { workspaceId, user };
        }
      }
    }
    return null;
  }
}
