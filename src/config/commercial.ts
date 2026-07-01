import type { CommercialPlan } from '../types';

export const COMMERCIAL_MODE = import.meta.env.VITE_COMMERCIAL_MODE !== 'false';

export const FREE_TRIAL_MINUTES = 15;

export const COMMERCIAL_PLANS: CommercialPlan[] = [
  {
    id: 'starter',
    name: '首面体验包',
    badge: '新用户推荐',
    priceLabel: '¥29',
    originalPriceLabel: '¥59',
    minutesLabel: '60 分钟',
    description: '适合临近一场面试，完整覆盖自我介绍、八股、项目深挖和复盘。',
    highlights: ['比 15 分钟试用更稳', '支持简历和知识库', '面试后生成复盘'],
    checkoutMode: 'payment',
    popular: true,
  },
  {
    id: 'pro',
    name: '冲刺加量包',
    badge: '高性价比',
    priceLabel: '¥69',
    originalPriceLabel: '¥129',
    minutesLabel: '180 分钟',
    description: '适合一周内多场面试，按岗位反复演练和复盘。',
    highlights: ['多场面试连续使用', '适合大厂流程', '更适合项目深挖'],
    checkoutMode: 'payment',
  },
  {
    id: 'monthly',
    name: '求职月卡',
    badge: '重度求职',
    priceLabel: '¥129/月',
    originalPriceLabel: '¥199/月',
    minutesLabel: '每月 600 分钟',
    description: '适合集中求职期，保持简历、知识库和面试记录长期同步。',
    highlights: ['月度额度更充足', '适合多岗位投递', '后续可做会员权益'],
    checkoutMode: 'subscription',
  },
];

export function commercialPlanById(id: string | undefined): CommercialPlan | undefined {
  return COMMERCIAL_PLANS.find((plan) => plan.id === id);
}
