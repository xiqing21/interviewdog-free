/**
 * Official support / community contacts for commercial & free clients.
 */
import { publicAssetUrl } from '../lib/assets';

export const SUPPORT_EMAIL = 'xiaosuange@gmail.com';
export const SUPPORT_MAILTO = `mailto:${SUPPORT_EMAIL}`;
export const SUPPORT_MAILTO_HELP = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('面试猪 · 使用帮助')}&body=${encodeURIComponent('你好，我在使用面试猪时遇到：\n\n账号：\n问题描述：\n')}`;

export const QQ_GROUP_ID = '592906421';
export const QQ_GROUP_NAME = '面试猪官方交流群';

export const WECHAT_DISPLAY_NAME = '郑逸晗';

export function qqGroupQrUrl(): string {
  return publicAssetUrl('contact/qr-qq-group.jpg');
}

export function wechatQrUrl(): string {
  return publicAssetUrl('contact/qr-wechat.jpg');
}
