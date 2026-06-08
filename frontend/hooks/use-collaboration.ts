"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
import { toast } from 'sonner';

export interface OnlineUser {
  userId: string;
  name: string;
  socketId: string;
  color: string;
}

export interface ActivityLog {
  id: string;
  eventType: string;
  createdAt: string;
  metadata: {
    name?: string;
    userName?: string;
    noteTitle?: string;
    removedUserName?: string;
  };
}

export function useCollaboration(workspaceId: string, noteId: string) {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isSynced, setIsSynced] = useState<boolean>(false);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [reconnectFailed, setReconnectFailed] = useState<boolean>(false);
  const [syncVersion, setSyncVersion] = useState<number>(0);
  
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [awareness, setAwareness] = useState<awarenessProtocol.Awareness | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const snapshotCallbackRef = useRef<(() => string) | null>(null);
  const lastNoteUpdateUserMap = useRef<Map<string, number>>(new Map());
  const isJoinedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!workspaceId || !noteId) return;

    // 1. Create a new Yjs Document
    const ydoc = new Y.Doc();

    // 2. Initialize Awareness
    const awareness = new awarenessProtocol.Awareness(ydoc);

    setYdoc(ydoc);
    setAwareness(awareness);

    // Get auth token
    const token = localStorage.getItem('collab_notes_token');
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

    // 3. Connect Socket.IO Client with robust reconnection options
    const socket = io(socketUrl, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    // On socket connection success
    socket.on('connect', () => {
      setIsConnected(true);
      isJoinedRef.current = false;
      setIsSynced(false);
      setIsReconnecting(false);
      setReconnectFailed(false);
      console.log(`Socket.IO connected. Joining workspace: ${workspaceId}, note: ${noteId}`);
      socket.emit('join_workspace', { workspaceId, noteId });
    });

    socket.on('disconnect', (reason) => {
      setIsConnected(false);
      isJoinedRef.current = false;
      setIsSynced(false);
      console.log('Socket.IO disconnected. Reason:', reason);
      if (reason === 'io server disconnect' || reason === 'io client disconnect') {
        setIsReconnecting(false);
      } else {
        setIsReconnecting(true);
      }
    });

    socket.on('reconnect_attempt', (attempt) => {
      console.log(`Socket.IO: Reconnection attempt ${attempt}/5`);
      setIsReconnecting(true);
      setReconnectFailed(false);
    });

    socket.on('reconnect_failed', () => {
      console.log('Socket.IO: Reconnection attempts failed completely');
      setReconnectFailed(true);
      setIsReconnecting(false);
    });

    socket.on('reconnect', () => {
      console.log('Socket.IO: Reconnected successfully');
      setReconnectFailed(false);
      setIsReconnecting(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket.IO connect_error:', error);
      const msg = error.message?.toLowerCase() || '';
      if (
        msg.includes('unauthorized') ||
        msg.includes('jwt') ||
        msg.includes('token') ||
        msg.includes('expired') ||
        msg.includes('forbidden') ||
        error.message === 'Forbidden'
      ) {
        toast.error("Your session has expired. Please sign in again.");
        setTimeout(() => {
          localStorage.removeItem('collab_notes_token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }, 2000);
      }
    });

    // 4. Implement Yjs Sync Handshake
    socket.on('sync_step1', (data: { noteId: string; stateVector: number[] }) => {
      if (data.noteId !== noteId) return;
      console.log('Client: Received sync_step1 from server');
      const { stateVector } = data;
      const clientUpdate = Y.encodeStateAsUpdate(ydoc, new Uint8Array(stateVector));
      const clientStateVector = Y.encodeStateVector(ydoc);

      console.log('Client: Emitting sync_step2 to server');
      socket.emit('sync_step2', {
        workspaceId,
        noteId,
        update: Array.from(clientUpdate),
        clientStateVector: Array.from(clientStateVector),
      });
    });

    socket.on('sync_complete', (data: { noteId: string; update: number[] }) => {
      if (data.noteId !== noteId) return;
      console.log('Client: Received sync_complete from server');
      const { update } = data;
      try {
        Y.applyUpdate(ydoc, new Uint8Array(update), 'remote');
      } catch (e) {
        console.warn('Client: Yjs sync_complete failed (potential corruption). Recreating Y.Doc...', e);
        setSyncVersion(prev => prev + 1);
      }
    });

    socket.on('doc_update', (data: { noteId: string; update: number[]; updatedBy?: { userId: string; name: string } }) => {
      if (data.noteId !== noteId) return;
      const { update, updatedBy } = data;
      try {
        Y.applyUpdate(ydoc, new Uint8Array(update), 'remote');
      } catch (e) {
        console.warn('Client: Yjs doc_update failed (potential corruption). Recreating Y.Doc...', e);
        setSyncVersion(prev => prev + 1);
        return;
      }

      if (updatedBy) {
        const now = Date.now();
        const lastUpdate = lastNoteUpdateUserMap.current.get(updatedBy.userId) || 0;
        if (now - lastUpdate > 10000) {
          lastNoteUpdateUserMap.current.set(updatedBy.userId, now);
          const newLog: ActivityLog = {
            id: `remote-note-update-${updatedBy.userId}-${now}`,
            eventType: 'note_updated',
            createdAt: new Date().toISOString(),
            metadata: { name: updatedBy.name }
          };
          setActivityLogs((prev) => [newLog, ...prev.slice(0, 49)]);
        }
      }
    });

    // Listen to ephemeral awareness updates (cursors/selections)
    socket.on('awareness_update', (data: { noteId: string; update: number[] }) => {
      if (data.noteId !== noteId) return;
      const { update } = data;
      awarenessProtocol.applyAwarenessUpdate(awareness, new Uint8Array(update), 'remote');
    });

    // Broadcast local updates to server — only AFTER join handshake completes
    ydoc.on('update', (update, origin) => {
      if (origin !== 'remote') {
        if (!isJoinedRef.current) {
          return;
        }
        socket.emit('doc_update', {
          workspaceId,
          noteId,
          update: Array.from(update),
        });

        // Throttle local note_updated activity log entries
        const storedUser = localStorage.getItem('user');
        let currentUserName = 'You';
        let currentUserId = 'me';
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            currentUserName = parsed.name || 'You';
            currentUserId = parsed.id || 'me';
          } catch (e) {}
        }
        
        const now = Date.now();
        const lastUpdate = lastNoteUpdateUserMap.current.get(currentUserId) || 0;
        if (now - lastUpdate > 10000) {
          lastNoteUpdateUserMap.current.set(currentUserId, now);
          const newLog: ActivityLog = {
            id: `local-note-update-me-${now}`,
            eventType: 'note_updated',
            createdAt: new Date().toISOString(),
            metadata: { name: currentUserName }
          };
          setActivityLogs((prev) => [newLog, ...prev.slice(0, 49)]);
        }
      }
    });

    // Handle local awareness updates — only AFTER join handshake completes
    const handleLocalAwareness = () => {
      if (!isJoinedRef.current) return;
      const update = awarenessProtocol.encodeAwarenessUpdate(awareness, [ydoc.clientID]);
      socket.emit('awareness_update', {
        workspaceId,
        noteId,
        update: Array.from(update),
      });
    };

    awareness.on('update', handleLocalAwareness);

    // Set local user details on the awareness instance
    const storedUser = localStorage.getItem('user');
    let userDetails = { name: 'Anonymous User' };
    if (storedUser) {
      try {
        userDetails = JSON.parse(storedUser);
      } catch (e) {
        console.error('Failed to parse stored user profile:', e);
      }
    }
    awareness.setLocalStateField('user', {
      name: userDetails.name,
    });

    // 5. Non-Yjs Socket Events
    socket.on('workspace_meta', (data: { onlineUsers: OnlineUser[]; activityLogs: ActivityLog[] }) => {
      console.log('Client: Received workspace_meta from server');
      isJoinedRef.current = true;
      setIsSynced(true);
      setOnlineUsers(data.onlineUsers);
      setActivityLogs(data.activityLogs);
    });

    socket.on('user_joined', (data: { user: OnlineUser; onlineUsers: OnlineUser[] }) => {
      setOnlineUsers(data.onlineUsers);
      toast.info(`${data.user.name} joined the workspace`);
    });

    socket.on('user_left', (data: { user: OnlineUser; onlineUsers: OnlineUser[] }) => {
      setOnlineUsers(data.onlineUsers);
      toast.info(`${data.user.name} left the workspace`);
    });

    socket.on('activity_log_added', (newLog: ActivityLog) => {
      setActivityLogs((prevLogs) => [newLog, ...prevLogs.slice(0, 49)]);
    });

    socket.on('error', (err: { message: string }) => {
      console.error('Socket error received:', err);
      const msg = err.message || '';
      if (
        msg.toLowerCase().includes('forbidden') ||
        msg.toLowerCase().includes('workspace') ||
        msg.toLowerCase().includes('active') ||
        msg.toLowerCase().includes('participant')
      ) {
        toast.error("You don't have access to that workspace");
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 1500);
      } else {
        toast.error(`Socket Error: ${err.message}`);
      }
    });

    // 6. Setup periodic 5s content snapshot pushes
    const snapshotInterval = setInterval(() => {
      if (socket.connected && snapshotCallbackRef.current) {
        try {
          const content = snapshotCallbackRef.current();
          socket.emit('content_snapshot', {
            workspaceId,
            noteId,
            content,
          });
        } catch (e) {
          console.error('Failed to capture and emit content snapshot:', e);
        }
      }
    }, 5000);

    // Clean up on unmount
    return () => {
      clearInterval(snapshotInterval);
      
      socket.off('connect');
      socket.off('disconnect');
      socket.off('reconnect_attempt');
      socket.off('reconnect_failed');
      socket.off('reconnect');
      socket.off('connect_error');
      socket.off('sync_step1');
      socket.off('sync_complete');
      socket.off('doc_update');
      socket.off('awareness_update');
      socket.off('workspace_meta');
      socket.off('user_joined');
      socket.off('user_left');
      socket.off('activity_log_added');
      socket.off('error');
      
      socket.disconnect();
      awareness.destroy();
      ydoc.destroy();
    };
  }, [workspaceId, noteId, syncVersion]);

  const setSnapshotCallback = useCallback((fn: () => string) => {
    snapshotCallbackRef.current = fn;
  }, []);

  return {
    ydoc,
    awareness,
    onlineUsers,
    activityLogs,
    isConnected,
    isSynced,
    isReconnecting,
    reconnectFailed,
    setSnapshotCallback,
    socket: socketRef.current, // Expose raw socket reference for manual listeners
  };
}
