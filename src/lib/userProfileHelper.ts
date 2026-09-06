/**
 * userProfileHelper — 为每个登录账户根据 User ID 或 Email 确定性生成专属的“猪猪”主题昵称与潮流像素/拟态头像
 */

// 契合“面试猪”主题的潮流形容词与猪猪代号
const PIG_ADJECTIVES = [
  '进击的', '暴走', '极客', '元气', '赛博', '光速', '王牌', '满绩',
  '飞天', '觉醒', '硬核', '锦鲤', '逆袭', '通关', '超能', '头号',
];

const PIG_TITLES = [
  '猪猪', '佩奇', '麦兜', '小八戒', '金猪', '战猪', '豚豚', '波仔',
  '猪神', '猪队长', '嘟嘟', '皮皮猪', '萌猪', '猪先锋',
];

/**
 * 简单字符串哈希算法 (32-bit FNV-1a)
 */
function hashString(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * 潮流极简猪猪头像颜色盘 (现代渐变风格)
 */
const AVATAR_PALETTES = [
  { bg: 'linear-gradient(135deg, #FF9A9E 0%, #FECFEF 99%, #FECFEF 100%)', text: '#D81B60', glow: 'rgba(255, 154, 158, 0.4)' },
  { bg: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)', text: '#6A1B9A', glow: 'rgba(161, 140, 209, 0.4)' },
  { bg: 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)', text: '#00695C', glow: 'rgba(132, 250, 176, 0.4)' },
  { bg: 'linear-gradient(135deg, #a6c0fe 0%, #f68084 100%)', text: '#C2185B', glow: 'rgba(246, 128, 132, 0.4)' },
  { bg: 'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)', text: '#4A148C', glow: 'rgba(213, 126, 235, 0.4)' },
  { bg: 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)', text: '#1565C0', glow: 'rgba(142, 197, 252, 0.4)' },
  { bg: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', text: '#AD1457', glow: 'rgba(245, 87, 108, 0.4)' },
  { bg: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', text: '#01579B', glow: 'rgba(79, 172, 254, 0.4)' },
  { bg: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', text: '#1B5E20', glow: 'rgba(67, 233, 123, 0.4)' },
  { bg: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', text: '#C2185B', glow: 'rgba(250, 112, 154, 0.4)' },
];

/**
 * 猪猪生动可爱的微表情/标志符号
 */
const PIG_EMOJIS = ['🐷', '🐽', '🐗', '✨', '🚀', '⚡️', '🏆', '🎯', '🍀', '🌟'];

export interface UserProfileInfo {
  displayName: string;
  avatarBg: string;
  avatarText: string;
  avatarGlow: string;
  emoji: string;
  shortCode: string;
}

/**
 * 获取与用户唯一绑定的专属猪猪昵称与现代头像配置
 */
export function getUserProfileInfo(identifier: string): UserProfileInfo {
  if (!identifier) {
    return {
      displayName: '面试猪用户',
      avatarBg: AVATAR_PALETTES[0].bg,
      avatarText: AVATAR_PALETTES[0].text,
      avatarGlow: AVATAR_PALETTES[0].glow,
      emoji: '🐷',
      shortCode: '888',
    };
  }

  const h = hashString(identifier.toLowerCase());
  const adjIndex = h % PIG_ADJECTIVES.length;
  const titleIndex = (h >>> 4) % PIG_TITLES.length;
  const paletteIndex = (h >>> 8) % AVATAR_PALETTES.length;
  const emojiIndex = (h >>> 12) % PIG_EMOJIS.length;

  // 4位唯一尾号
  const hexPart = (h & 0xffff).toString(16).toUpperCase().padStart(4, '0');
  const palette = AVATAR_PALETTES[paletteIndex];
  const displayName = `${PIG_ADJECTIVES[adjIndex]}${PIG_TITLES[titleIndex]} #${hexPart}`;

  return {
    displayName,
    avatarBg: palette.bg,
    avatarText: palette.text,
    avatarGlow: palette.glow,
    emoji: PIG_EMOJIS[emojiIndex],
    shortCode: hexPart,
  };
}
