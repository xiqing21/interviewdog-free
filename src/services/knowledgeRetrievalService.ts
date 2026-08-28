import type { KnowledgeLibraryItem } from '../types';

export type RetrievedKnowledgeSnippet = {
  source: string;
  heading?: string;
  text: string;
  score: number;
  kind: 'qa' | 'chunk';
};

const MAX_CHUNK_CHARS = 720;
const MIN_CHUNK_CHARS = 180;
const MAX_SNIPPET_CHARS = 5200;
const MAX_CHUNKS_PER_ITEM = 2;
const MAX_QA_HITS = 4;
const MAX_DOC_HITS = 6;

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[，。！？、,.!?;；:\s]/g, '')
    .replace(/[啊呀呢吧吗嘛]/g, '')
    .trim();
}

function bigramDice(a: string, b: string): number {
  const left = normalize(a);
  const right = normalize(b);
  if (!left || !right) return 0;
  if (left.includes(right) || right.includes(left)) {
    return Math.min(left.length, right.length) / Math.max(left.length, right.length);
  }
  const grams = (value: string) => {
    const set = new Set<string>();
    for (let i = 0; i < value.length - 1; i += 1) set.add(value.slice(i, i + 2));
    return set;
  };
  const leftSet = grams(left);
  const rightSet = grams(right);
  if (leftSet.size === 0 || rightSet.size === 0) return left === right ? 1 : 0;
  let overlap = 0;
  for (const item of leftSet) {
    if (rightSet.has(item)) overlap += 1;
  }
  return (2 * overlap) / (leftSet.size + rightSet.size);
}

function extractKeywords(text: string): string[] {
  const terms = new Set<string>();
  for (const token of text.match(/[A-Za-z][A-Za-z0-9+._-]{1,}/g) ?? []) {
    terms.add(token.toLowerCase());
  }
  const compact = normalize(text);
  for (let i = 0; i < compact.length - 1; i += 1) {
    const gram = compact.slice(i, i + 2);
    if (gram.length === 2) terms.add(gram);
  }
  return [...terms];
}

function keywordHitRatio(question: string, target: string): number {
  const keys = extractKeywords(question);
  if (keys.length === 0) return 0;
  const haystack = `${normalize(target)} ${target.toLowerCase()}`;
  let hits = 0;
  for (const key of keys) {
    if (haystack.includes(key)) hits += 1;
  }
  return hits / keys.length;
}

function scoreAgainstQuestion(question: string, target: string, heading = ''): number {
  const lexical = bigramDice(question, target);
  const keywords = keywordHitRatio(question, `${heading}\n${target}`);
  const titleBoost = heading ? keywordHitRatio(question, heading) * 0.2 : 0;
  return lexical * 0.55 + keywords * 0.35 + titleBoost;
}

function splitOversized(text: string): string[] {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_CHUNK_CHARS) return trimmed ? [trimmed] : [];
  const sentences = trimmed.split(/(?<=[。！？!?\n])/);
  const parts: string[] = [];
  let buffer = '';
  for (const sentence of sentences) {
    if ((buffer + sentence).length > MAX_CHUNK_CHARS && buffer.length >= MIN_CHUNK_CHARS) {
      parts.push(buffer.trim());
      buffer = sentence;
    } else {
      buffer += sentence;
    }
  }
  if (buffer.trim()) parts.push(buffer.trim());
  return parts;
}

function chunkDocument(content: string): Array<{ heading: string; text: string }> {
  const source = content.replace(/\r\n/g, '\n').trim();
  if (!source) return [];
  const sections = source.split(/(?=^#{1,3}\s+)/m);
  const chunks: Array<{ heading: string; text: string }> = [];
  for (const section of sections) {
    const heading = section.match(/^#{1,3}\s+(.+)$/m)?.[1]?.trim() ?? '';
    const body = heading ? section.replace(/^#{1,3}\s+.+$/m, '').trim() : section.trim();
    const paragraphs = (body || section).split(/\n{2,}/);
    let buffer = heading ? `${heading}\n` : '';
    for (const paragraph of paragraphs) {
      const next = buffer ? `${buffer}\n\n${paragraph}` : paragraph;
      if (next.length > MAX_CHUNK_CHARS && buffer.trim().length >= MIN_CHUNK_CHARS) {
        chunks.push(...splitOversized(buffer).map((text) => ({ heading, text })));
        buffer = paragraph;
      } else {
        buffer = next;
      }
    }
    if (buffer.trim()) {
      chunks.push(...splitOversized(buffer).map((text) => ({ heading, text })));
    }
  }
  return chunks.filter((chunk) => chunk.text.replace(/\s/g, '').length >= 12);
}

export function buildKnowledgeCatalog(items: KnowledgeLibraryItem[], manualText = ''): string {
  const names = items.map((item) => {
    const chars = (item.content ?? '').length;
    const kind = item.type === 'qa' ? 'QA' : item.type === 'webpage' ? '网页' : item.type === 'text' ? '文本' : '文档';
    return `${item.name}（${kind}${chars ? `，${chars}字` : ''}）`;
  });
  if (manualText.trim()) names.unshift('本项目临时补充');
  if (names.length === 0) return '';
  return `已挂载 ${names.length} 份材料：${names.join('、')}。回答时只依据本题检索到的片段，不要编造未出现的项目细节。`;
}

export function retrieveKnowledgeSnippets(
  question: string,
  items: KnowledgeLibraryItem[],
  manualText = '',
): { qaHits: RetrievedKnowledgeSnippet[]; docHits: RetrievedKnowledgeSnippet[] } {
  const qaCandidates: RetrievedKnowledgeSnippet[] = [];
  const docCandidates: RetrievedKnowledgeSnippet[] = [];

  const considerManual = manualText.trim();
  const allItems: KnowledgeLibraryItem[] = considerManual
    ? [{
        id: 'session-manual',
        name: '本项目临时补充',
        content: considerManual,
        type: 'text',
        createdAt: 0,
        updatedAt: 0,
      }, ...items]
    : items;

  for (const item of allItems) {
    if (item.type === 'qa' && item.qaPairs?.length) {
      for (const pair of item.qaPairs) {
        const questionScore = scoreAgainstQuestion(question, pair.question, item.name);
        const answerScore = scoreAgainstQuestion(question, pair.answer, item.name);
        const score = Math.max(questionScore, questionScore * 0.75 + answerScore * 0.25);
        qaCandidates.push({
          source: item.name,
          heading: pair.question,
          text: `Q: ${pair.question}\nA: ${pair.answer}`,
          score,
          kind: 'qa',
        });
      }
      continue;
    }
    for (const chunk of chunkDocument(item.content || '')) {
      const score = scoreAgainstQuestion(question, chunk.text, `${item.name} ${chunk.heading}`);
      docCandidates.push({
        source: item.name,
        heading: chunk.heading,
        text: chunk.text,
        score,
        kind: 'chunk',
      });
    }
  }

  const qaHits = qaCandidates
    .filter((item) => item.score >= 0.16)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_QA_HITS);

  const MIN_DOC_SCORE = 0.08;
  const rankedDocs = docCandidates.sort((a, b) => b.score - a.score);
  const docHits: RetrievedKnowledgeSnippet[] = [];
  const perItem = new Map<string, number>();
  for (const candidate of rankedDocs) {
    if (candidate.score < MIN_DOC_SCORE && docHits.length >= 2) break;
    if (candidate.score < MIN_DOC_SCORE) continue;
    const used = perItem.get(candidate.source) ?? 0;
    if (used >= MAX_CHUNKS_PER_ITEM) continue;
    docHits.push(candidate);
    perItem.set(candidate.source, used + 1);
    if (docHits.length >= MAX_DOC_HITS) break;
  }

  if (docHits.length === 0 && rankedDocs[0]) {
    docHits.push(rankedDocs[0]);
  }

  return { qaHits, docHits };
}

export function formatRetrievedKnowledge(
  qaHits: RetrievedKnowledgeSnippet[],
  docHits: RetrievedKnowledgeSnippet[],
): string {
  const parts: string[] = [];
  let budget = MAX_SNIPPET_CHARS;
  if (qaHits.length) {
    const qaText = qaHits
      .map((item, index) => `${index + 1}. 来源：${item.source}\n${item.text}`)
      .join('\n\n');
    const sliced = qaText.slice(0, Math.min(2200, budget));
    parts.push(`命中的专家库 QA（优先参考）：\n${sliced}`);
    budget -= sliced.length;
  }
  if (docHits.length && budget > 400) {
    const docText = docHits
      .map((item, index) => {
        const title = item.heading ? `${item.source} / ${item.heading}` : item.source;
        return `${index + 1}. 来源：${title}\n${item.text}`;
      })
      .join('\n\n');
    parts.push(`本题检索到的知识库片段：\n${docText.slice(0, budget)}`);
  }
  return parts.join('\n\n').slice(0, MAX_SNIPPET_CHARS);
}


