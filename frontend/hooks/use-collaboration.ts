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
  };
}

export function useCollaboration(workspaceId: string) {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  // useState for ydoc/awareness so setting them triggers a re-render
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [awareness, setAwareness] = useState<awarenessProtocol.Awareness | null>(null);

  // References to keep stable access across effects without triggering re-renders
  const socketRef = useRef<Socket | null>(null);
  const snapshotCallbackRef = useRef<(() => string) | null>(null);
  const lastNoteUpdateUserMap = useRef<Map<string, number>>(new Map());
  // Gate: only emit doc_update / awareness_update AFTER the workspace join handshake
  // completes (after workspace_meta is received). Without this, Yjs fires updates on
  // editor init BEFORE join_workspace, causing "Forbidden: not active in workspace room".
  const isJoinedRef = useRef<boolean>(false);

  useEffect(() => {
    // 1. Create a new Yjs Document
    const ydoc = new Y.Doc();

    // 2. Initialize Awareness
    const awareness = new awarenessProtocol.Awareness(ydoc);

    // Expose to React so the workspace page can render the editor
    setYdoc(ydoc);
    setAwareness(awareness);

    // Get auth token
    const token = localStorage.getItem('collab_notes_token');
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';

    // 3. Connect Socket.IO Client
    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    // On socket connection success
    socket.on('connect', () => {
      setIsConnected(true);
      isJoinedRef.current = false; // reset on each (re)connect
      console.log('Socket.IO connected. Joining workspace:', workspaceId);
      socket.emit('join_workspace', { workspaceId });
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      isJoinedRef.current = false; // reset so reconnect re-runs handshake
      console.log('Socket.IO disconnected.');
    });

    // 4. Implement Yjs Sync Handshake
    socket.on('sync_step1', (data: { stateVector: number[] }) => {
      const { stateVector } = data;
      // Compute updates that the client has but the server is missing
      const clientUpdate = Y.encodeStateAsUpdate(ydoc, new Uint8Array(stateVector));
      const clientStateVector = Y.encodeStateVector(ydoc);

      // Send missing client updates and client's own state vector back to server
      socket.emit('sync_step2', {
        workspaceId,
        update: Array.from(clientUpdate),
        clientStateVector: Array.from(clientStateVector),
      });
    });

    socket.on('sync_complete', (data: { update: number[] }) => {
      const { update } = data;
      // Apply server's missing updates to local ydoc
      Y.applyUpdate(ydoc, new Uint8Array(update), 'remote');
    });

    // Listen to real-time doc updates from other clients
    socket.on('doc_update', (data: { update: number[]; updatedBy?: { userId: string; name: string } }) => {
      const { update, updatedBy } = data;
      Y.applyUpdate(ydoc, new Uint8Array(update), 'remote');

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
    socket.on('awareness_update', (data: { update: number[] }) => {
      const { update } = data;
      awarenessProtocol.applyAwarenessUpdate(awareness, new Uint8Array(update), 'remote');
    });

    // Broadcast local updates to server — only AFTER join handshake completes
    ydoc.on('update', (update, origin) => {
      if (origin !== 'remote') {
        if (!isJoinedRef.current) {
          // Too early — handshake not finished yet. Drop silently.
          return;
        }
        socket.emit('doc_update', {
          workspaceId,
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
        update: Array.from(update),
      });
    };

    // When the local client's cursor/state updates, broadcast to other users
    awareness.on('update', handleLocalAwareness);

    // Set local user details on the awareness instance
    const storedUser = localStorage.getItem('user'); // we can fetch from localStorage if stored, or decode token
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
      // Handshake complete — it is now safe to broadcast local doc/awareness updates
      isJoinedRef.current = true;
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

    // Handle Errors
    socket.on('error', (err: { message: string }) => {
      toast.error(`Socket Error: ${err.message}`);
    });

    // 6. Setup periodic 5s content snapshot pushes
    const snapshotInterval = setInterval(() => {
      if (socket.connected && snapshotCallbackRef.current) {
        try {
          const content = snapshotCallbackRef.current();
          socket.emit('content_snapshot', {
            workspaceId,
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
  }, [workspaceId]);

  const setSnapshotCallback = useCallback((fn: () => string) => {
    snapshotCallbackRef.current = fn;
  }, []);

  return {
    ydoc,
    awareness,
    onlineUsers,
    activityLogs,
    isConnected,
    setSnapshotCallback,
  };
}
