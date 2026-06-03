import { Injectable } from '@nestjs/common';
import * as Y from 'yjs';

@Injectable()
export class YdocStoreService {
  private readonly docs = new Map<string, Y.Doc>();

  getOrCreate(workspaceId: string, initialState?: Buffer | null): Y.Doc {
    let doc = this.docs.get(workspaceId);
    if (!doc) {
      doc = new Y.Doc();
      if (initialState) {
        try {
          Y.applyUpdate(doc, new Uint8Array(initialState));
        } catch (error) {
          console.error(`Failed to apply initial update for workspace ${workspaceId}:`, error);
        }
      }
      this.docs.set(workspaceId, doc);
    }
    return doc;
  }

  applyUpdate(workspaceId: string, update: Uint8Array): void {
    const doc = this.getOrCreate(workspaceId);
    Y.applyUpdate(doc, update);
  }

  getStateVector(workspaceId: string): Uint8Array {
    const doc = this.getOrCreate(workspaceId);
    return Y.encodeStateVector(doc);
  }

  getUpdate(workspaceId: string, stateVector: Uint8Array): Uint8Array {
    const doc = this.getOrCreate(workspaceId);
    return Y.encodeStateAsUpdate(doc, stateVector);
  }

  encodeFullState(workspaceId: string): Uint8Array {
    const doc = this.getOrCreate(workspaceId);
    return Y.encodeStateAsUpdate(doc);
  }

  destroy(workspaceId: string): void {
    const doc = this.docs.get(workspaceId);
    if (doc) {
      doc.destroy();
      this.docs.delete(workspaceId);
    }
  }

  hasActiveDoc(workspaceId: string): boolean {
    return this.docs.has(workspaceId);
  }
}
