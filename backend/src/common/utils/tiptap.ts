export function tiptapJsonToPlainText(jsonStr: string): string {
  if (!jsonStr) return '';
  try {
    const obj = JSON.parse(jsonStr);
    return extractText(obj);
  } catch (e) {
    return jsonStr;
  }
}

function extractText(node: any): string {
  if (!node) return '';
  if (node.type === 'text' && typeof node.text === 'string') {
    return node.text;
  }
  let text = '';
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      text += extractText(child) + ' ';
    }
  }
  return text.trim();
}

export function getSnippet(plainText: string, keyword: string, length = 150): string {
  if (!plainText) return '';
  if (!keyword) {
    const sub = plainText.substring(0, length);
    return sub.length < plainText.length ? sub + '...' : sub;
  }
  
  const idx = plainText.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx === -1) {
    const sub = plainText.substring(0, length);
    return sub.length < plainText.length ? sub + '...' : sub;
  }
  
  const start = Math.max(0, idx - Math.floor(length / 3));
  const end = Math.min(plainText.length, start + length);
  let snippet = plainText.substring(start, end);
  if (start > 0) {
    snippet = '...' + snippet;
  }
  if (end < plainText.length) {
    snippet = snippet + '...';
  }
  return snippet;
}
