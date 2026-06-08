import { Injectable } from '@nestjs/common';
import * as Y from 'yjs';

@Injectable()
export class YdocStoreService {
  private readonly docs = new Map<string, Y.Doc>();

  getOrCreate(noteId: string, initialState?: Buffer | null, defaultContentJson?: string): Y.Doc {
    let doc = this.docs.get(noteId);
    if (!doc) {
      doc = new Y.Doc();
      if (initialState && initialState.length > 0) {
        try {
          Y.applyUpdate(doc, new Uint8Array(initialState));
        } catch (error) {
          console.error(`Failed to apply initial update for note ${noteId}:`, error);
        }
      } else if (defaultContentJson) {
        try {
          const parsed = JSON.parse(defaultContentJson);
          const xmlFragment = doc.getXmlFragment('default');
          
          const prosemirrorToYjs = (node: any, yParent: any) => {
            if (!node) return;
            if (node.type === 'text') {
              const yText = new Y.XmlText(node.text);
              yParent.insert(yParent.length, [yText]);
            } else {
              const yElement = new Y.XmlElement(node.type);
              if (node.attrs) {
                for (const [key, value] of Object.entries(node.attrs)) {
                  if (value !== undefined && value !== null) {
                    yElement.setAttribute(key, String(value));
                  }
                }
              }
              if (Array.isArray(node.content)) {
                for (const child of node.content) {
                  prosemirrorToYjs(child, yElement);
                }
              }
              yParent.insert(yParent.length, [yElement]);
            }
          };

          if (parsed && Array.isArray(parsed.content)) {
            for (const child of parsed.content) {
              prosemirrorToYjs(child, xmlFragment);
            }
          }
        } catch (error) {
          console.error(`Failed to populate Ydoc from default JSON content for note ${noteId}:`, error);
        }
      }
      this.docs.set(noteId, doc);
    }
    return doc;
  }

  applyUpdate(noteId: string, update: Uint8Array): void {
    try {
      const doc = this.getOrCreate(noteId);
      Y.applyUpdate(doc, update);
    } catch (error) {
      console.error(`Failed to apply update for note ${noteId}:`, error);
    }
  }

  getStateVector(noteId: string): Uint8Array {
    const doc = this.getOrCreate(noteId);
    return Y.encodeStateVector(doc);
  }

  getUpdate(noteId: string, stateVector: Uint8Array): Uint8Array {
    const doc = this.getOrCreate(noteId);
    return Y.encodeStateAsUpdate(doc, stateVector);
  }

  encodeFullState(noteId: string): Uint8Array {
    const doc = this.getOrCreate(noteId);
    return Y.encodeStateAsUpdate(doc);
  }

  destroy(noteId: string): void {
    const doc = this.docs.get(noteId);
    if (doc) {
      doc.destroy();
      this.docs.delete(noteId);
    }
  }

  hasActiveDoc(noteId: string): boolean {
    return this.docs.has(noteId);
  }
}
