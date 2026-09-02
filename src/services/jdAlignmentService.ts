/**
 * JD-first alignment helpers.
 *
 * Live answers used to overweight the resume because it is longer and appears
 * first in the prompt. These helpers distill JD must-cover signals and the
 * resume gaps so every generation can put the job description above the CV.
 */

import { RESUME_JD_PROMPT_TEMPLATE } from '../constants';

export interface JdAlignment {
  signals: string[];
  matched: string[];
  gaps: string[];
  requirementLines: string[];
}

const LATIN_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'your', 'you', 'our',
  'will', 'are', 'is', 'of', 'in', 'on', 'to', 'or', 'as', 'be', 'by', 'an',
  'we', 'at', 'plus', 'etc', 'job', 'role', 'team', 'work', 'years', 'year',
  'good', 'nice', 'able', 'using', 'used', 'use', 'including', 'related',
]);

const KEEP_SHORT_TOKENS = new Set([
  'sql', 'jvm', 'api', 'gc', 'io', 'mq', 'ui', 'olap', 'oltp', 'etl', 'cdc',
  'rpc', 'sdk', 'hdfs', 'yarn', 'k8s', 'aws', 'gcp',
]);

const ZH_SIGNALS = [
  '实时数仓', '离线数仓', '数据湖', '湖仓一体', '湖仓', '高并发', '性能优化',
  'JVM 调优', 'JVM调优', '内存调优', '状态管理', '反压', '乱序', '窗口',
  '精确一次', '端到端', '流批一体', '数据治理', '任务调度', '血缘',
  '数仓建模', '维度建模', '指标口径', '实时计算', '流计算', '批处理',
  '状态后端', '两阶段提交', '端到端一致性',
];

const REQUIREMENT_HINT = /熟悉|精通|掌握|负责|优先|要求|必须|具备|能够|擅长|深度|实战|调优|优化|研发|开发/;

export function analyzeJdAlignment(jd: string, resume: string): JdAlignment {
  const jdText = jd.trim();
  const resumeText = resume.trim();
  if (!jdText) {
    return { signals: [], matched: [], gaps: [], requirementLines: [] };
  }

  const requirementLines = jdText
    .split(/[\n。；;]/)
    .map((line) => line.replace(/^[\s·•\-\d.、]+/, '').trim())
    .filter((line) => line.length >= 8 && REQUIREMENT_HINT.test(line))
    .slice(0, 8);

  const signals = uniqueKeepOrder([
    ...extractLatinTokens(jdText),
    ...ZH_SIGNALS.filter((term) => jdText.includes(term)),
  ]).slice(0, 16);

  if (!resumeText) {
    return { signals, matched: [], gaps: signals.slice(0, 8), requirementLines };
  }

  const resumeHaystack = resumeText.toLowerCase();
  const matched: string[] = [];
  const gaps: string[] = [];
  for (const signal of signals) {
    if (resumeHaystack.includes(signal.toLowerCase())) matched.push(signal);
    else gaps.push(signal);
  }

  return {
    signals,
    matched: matched.slice(0, 12),
    gaps: gaps.slice(0, 8),
    requirementLines,
  };
}

export function buildResumeJdPrompt(resume: string, jd: string): string {
  const analysis = analyzeJdAlignment(jd, resume);
  const signalText = analysis.signals.length
    ? analysis.signals.map((item) => `- ${item}`).join('\n')
    : '（未解析到明确技术栈，仍以 JD 原文为准）';
  const gapText = !jd.trim()
    ? '（未粘贴 JD）'
    : analysis.gaps.length
      ? analysis.gaps.map((item) => `- ${item}`).join('\n')
      : '（简历已覆盖主要 JD 关键词）';
  const requirementText = analysis.requirementLines.length
    ? analysis.requirementLines.map((item) => `- ${item}`).join('\n')
    : '（未抽到职责短句，仍以 JD 原文为准）';

  return RESUME_JD_PROMPT_TEMPLATE
    .replace('{jd}', jd.trim() || '（未设置）')
    .replace('{resume}', resume.trim() || '（未设置）')
    .replace('{jdSignals}', signalText)
    .replace('{jdGaps}', gapText)
    .replace('{jdRequirements}', requirementText);
}

function extractLatinTokens(text: string): string[] {
  const tokens = text.match(/[A-Za-z][A-Za-z0-9+._/#-]{1,}/g) ?? [];
  const kept: string[] = [];
  for (const raw of tokens) {
    const token = raw.replace(/[._/-]+$/g, '');
    const key = token.toLowerCase();
    if (LATIN_STOPWORDS.has(key)) continue;
    if (token.length < 3 && !KEEP_SHORT_TOKENS.has(key)) continue;
    if (token.length > 32) continue;
    kept.push(normalizeTokenDisplay(token));
  }
  return uniqueKeepOrder(kept);
}

function normalizeTokenDisplay(token: string): string {
  if (token.toLowerCase() === 'datastream') return 'DataStream';
  if (token.toLowerCase() === 'jvm') return 'JVM';
  if (token.toLowerCase() === 'api') return 'API';
  return token;
}

function uniqueKeepOrder(items: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}
