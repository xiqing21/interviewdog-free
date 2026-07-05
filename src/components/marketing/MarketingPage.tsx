import { Box, Button, Chip, Paper, Typography } from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DesktopMacIcon from '@mui/icons-material/DesktopMac';
import LanguageIcon from '@mui/icons-material/Language';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { Link } from 'react-router-dom';

const features = [
  {
    icon: <GraphicEqIcon />,
    title: '实时识别面试官问题',
    desc: '选择会议窗口并共享系统音频，面试官声音进入实时转写链路，你自己的麦克风只做记录和复盘上下文。',
  },
  {
    icon: <ArticleOutlinedIcon />,
    title: '简历和知识库增强',
    desc: '挂载多份简历、岗位 JD、专家知识库和自定义热词，让回答更贴合你的真实项目经历。',
  },
  {
    icon: <AutoAwesomeIcon />,
    title: '多种回答策略',
    desc: '普通、精简、详细、STAR 结构、联网搜索补充都能在面试中切换，并支持随时重新生成。',
  },
  {
    icon: <ShieldOutlinedIcon />,
    title: '低干扰面试辅助',
    desc: '网页端安静运行，答案区和对话记录分离，减少操作干扰，把注意力留给真实沟通。',
  },
];

const scenarios = ['自我介绍', '八股文追问', '项目深挖', 'STAR 行为面', '大数据面试', 'Web3 面试'];

export function MarketingPage() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        overflow: 'auto',
        color: '#142033',
        background:
          'radial-gradient(circle at 12% 8%, rgba(125, 211, 252, 0.55), transparent 30%), radial-gradient(circle at 84% 0%, rgba(255, 185, 185, 0.55), transparent 28%), linear-gradient(135deg, #f7fbff 0%, #eef7f2 48%, #fff7ef 100%)',
      }}
    >
      <Box sx={{ maxWidth: 1180, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 2, md: 3 } }}>
        <Box
          component="header"
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            py: 1.25,
          }}
        >
          <Box component="img" src="/logo.svg" alt="面试猪" sx={{ width: 42, height: 42 }} />
          <Typography variant="h6" fontWeight={950} sx={{ flex: 1 }}>面试猪</Typography>
          <Button component={Link} to="/billing" variant="text" sx={{ display: { xs: 'none', sm: 'inline-flex' }, color: '#263244' }}>
            套餐
          </Button>
          <Button component={Link} to="/interview" variant="outlined" sx={{ bgcolor: 'rgba(255,255,255,0.5)' }}>
            登录/注册
          </Button>
          <Button component={Link} to="/interview" variant="contained" endIcon={<ArrowForwardIcon />}>
            打开网页版
          </Button>
        </Box>

        <Box
          component="main"
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1.02fr 0.98fr' },
            gap: { xs: 4, md: 6 },
            alignItems: 'center',
            pt: { xs: 4, md: 7 },
            pb: { xs: 4, md: 7 },
          }}
        >
          <Box>
            <Chip label="AI 实时面试辅助" color="primary" sx={{ mb: 2, fontWeight: 900 }} />
            <Typography
              component="h1"
              sx={{
                fontSize: { xs: 42, sm: 58, md: 72 },
                lineHeight: 1.02,
                fontWeight: 950,
                letterSpacing: 0,
                maxWidth: 720,
              }}
            >
              面试官刚问完，
              <Box component="span" sx={{ color: '#4f8fdf' }}>答案已经在这里。</Box>
            </Typography>
            <Typography sx={{ mt: 2.5, color: '#52657b', fontSize: { xs: 17, md: 20 }, lineHeight: 1.8, maxWidth: 640 }}>
              面试猪识别会议系统音频，结合你的简历、岗位 JD、知识库和热词，实时生成更像你本人经历的回答。适合远程面试、项目深挖、八股文追问和面试后复盘。
            </Typography>
            <Box sx={{ display: 'flex', gap: 1.2, flexWrap: 'wrap', mt: 3 }}>
              <Button component={Link} to="/interview" size="large" variant="contained" endIcon={<ArrowForwardIcon />}>
                立即使用网页版
              </Button>
              <Button size="large" variant="outlined" disabled startIcon={<DesktopMacIcon />}>
                Mac 客户端即将上线
              </Button>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 3 }}>
              {scenarios.map((item) => <Chip key={item} label={item} sx={{ bgcolor: 'rgba(255,255,255,0.64)' }} />)}
            </Box>
          </Box>

          <HeroDemo />
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 1.5, pb: { xs: 4, md: 6 } }}>
          {features.map((feature) => (
            <Paper
              key={feature.title}
              sx={{
                p: 2.2,
                borderRadius: 3,
                bgcolor: 'rgba(255,255,255,0.68)',
                backdropFilter: 'blur(18px)',
                boxShadow: '0 18px 42px rgba(66, 92, 120, 0.14)',
              }}
            >
              <Box sx={{ color: '#4f8fdf', mb: 1 }}>{feature.icon}</Box>
              <Typography fontWeight={950} sx={{ mb: 0.75 }}>{feature.title}</Typography>
              <Typography variant="body2" color="#5f7083" sx={{ lineHeight: 1.75 }}>{feature.desc}</Typography>
            </Paper>
          ))}
        </Box>

        <Paper
          sx={{
            mb: 6,
            p: { xs: 2.5, md: 4 },
            borderRadius: 4,
            bgcolor: '#162132',
            color: '#f4fbff',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <Box sx={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '0.9fr 1.1fr' }, gap: 3, alignItems: 'center' }}>
            <Box>
              <Chip label="隐身遮板效果" sx={{ mb: 2, bgcolor: '#7dd3fc', color: '#0b2035', fontWeight: 900 }} />
              <Typography variant="h4" component="h2" fontWeight={950} sx={{ mb: 1.5 }}>
                答案自己看，面试画面不抢戏
              </Typography>
              <Typography color="rgba(244,251,255,0.72)" sx={{ lineHeight: 1.9 }}>
                参考“遮板”思路，面试猪把回答区做成低干扰浮层视觉：你能快速扫到要点，会议窗口和屏幕共享内容依然保持清爽。网页端无需安装，Mac 客户端后续会把这个体验做得更完整。
              </Typography>
              <Box sx={{ mt: 2, display: 'grid', gap: 1 }}>
                {['面试官问题自动触发', '我的回答只转写留档', '回答可精简/详细/STAR 重写'].map((item) => (
                  <Box key={item} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CheckCircleIcon color="success" fontSize="small" />
                    <Typography>{item}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
            <StealthBoard />
          </Box>
        </Paper>

        <Paper
          sx={{
            p: { xs: 2.5, md: 3 },
            mb: 4,
            borderRadius: 4,
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 2,
            alignItems: { md: 'center' },
            bgcolor: 'rgba(255,255,255,0.72)',
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" component="h2" fontWeight={950}>先用 15 分钟免费试试</Typography>
            <Typography color="#647587" sx={{ mt: 0.5 }}>正常面试建议准备 30-60 分钟时长。网页版现在可用，Mac 客户端正在排期。</Typography>
          </Box>
          <Button component={Link} to="/interview" variant="contained" size="large" startIcon={<LanguageIcon />}>
            进入网页版
          </Button>
          <Button component={Link} to="/billing" variant="outlined" size="large">
            查看套餐
          </Button>
        </Paper>
      </Box>
    </Box>
  );
}

function HeroDemo() {
  return (
    <Paper
      sx={{
        p: 2,
        borderRadius: 4,
        bgcolor: 'rgba(255,255,255,0.72)',
        boxShadow: '0 26px 60px rgba(66, 92, 120, 0.18)',
        overflow: 'hidden',
      }}
    >
      <Box sx={{ borderRadius: 3, bgcolor: '#202938', color: '#ecf6ff', p: 1.5, minHeight: 430, position: 'relative', overflow: 'hidden' }}>
        <Box sx={{ display: 'flex', gap: 0.75, mb: 1.5 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#ff7f6e' }} />
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#f6c177' }} />
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#43b883' }} />
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: '0.75fr 1.3fr 0.9fr', gap: 1.2 }}>
          <DemoPanel title="面试官问题" lines={['请先做个自我介绍', '为什么选择 Flink + StarRocks？', '你怎么处理数据乱序？']} />
          <DemoAnswer />
          <DemoPanel title="双方对话记录" lines={['面试官：讲一下最近项目', '我：这个项目主要是...', '面试官：延迟怎么优化？']} />
        </Box>
        <Box sx={{ position: 'absolute', right: 18, bottom: 18, width: 190, borderRadius: 3, p: 1.4, bgcolor: 'rgba(125,211,252,0.16)', border: '1px solid rgba(125,211,252,0.3)' }}>
          <Typography fontWeight={900}>已识别 488ms</Typography>
          <Typography variant="caption" color="rgba(236,246,255,0.66)">系统音频 · Gateway 实时</Typography>
        </Box>
      </Box>
    </Paper>
  );
}

function DemoPanel({ title, lines }: { title: string; lines: string[] }) {
  return (
    <Box sx={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 2, p: 1.2, minHeight: 330 }}>
      <Typography fontWeight={900} sx={{ mb: 1 }}>{title}</Typography>
      {lines.map((line, index) => (
        <Box key={line} sx={{ p: 1, mb: 0.75, borderRadius: 1.5, bgcolor: index === 0 ? 'rgba(125,211,252,0.18)' : 'rgba(255,255,255,0.06)' }}>
          <Typography variant="caption">{line}</Typography>
        </Box>
      ))}
    </Box>
  );
}

function DemoAnswer() {
  return (
    <Box sx={{ border: '1px solid rgba(125,211,252,0.24)', borderRadius: 2, p: 1.4, minHeight: 330, bgcolor: 'rgba(255,255,255,0.04)' }}>
      <Typography fontWeight={950} sx={{ mb: 1 }}>AI 回答</Typography>
      <Typography variant="body2" sx={{ lineHeight: 1.9 }}>
        面试官您好，我会从业务背景、技术选型和落地效果三个角度说明。这个项目核心是把离线数仓和实时链路统一起来...
      </Typography>
      <Box sx={{ mt: 1.5, display: 'grid', gap: 1 }}>
        {['业务目标：降低报表延迟', '技术方案：Flink CDC + Fluss + StarRocks', '项目结果：查询效率提升 60%+'].map((item) => (
          <Chip key={item} label={item} size="small" sx={{ justifyContent: 'flex-start', bgcolor: 'rgba(125,211,252,0.14)', color: '#dff6ff' }} />
        ))}
      </Box>
    </Box>
  );
}

function StealthBoard() {
  return (
    <Box sx={{ position: 'relative', minHeight: 310, borderRadius: 3, bgcolor: '#0f1724', p: 2, overflow: 'hidden' }}>
      <Box sx={{ position: 'absolute', inset: 18, borderRadius: 2.5, bgcolor: '#1d2a3e', border: '1px solid rgba(255,255,255,0.1)' }}>
        <Box sx={{ p: 2 }}>
          <Typography variant="caption" color="rgba(255,255,255,0.55)">腾讯会议 / 飞书会议 / 微信通话</Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.2, mt: 1.5 }}>
            {[1, 2, 3, 4].map((item) => <Box key={item} sx={{ height: 74, borderRadius: 2, bgcolor: 'rgba(255,255,255,0.08)' }} />)}
          </Box>
        </Box>
      </Box>
      <Box
        sx={{
          position: 'absolute',
          right: 28,
          bottom: 28,
          width: { xs: 220, sm: 280 },
          p: 1.5,
          borderRadius: 2.5,
          bgcolor: 'rgba(244, 251, 255, 0.13)',
          color: '#f4fbff',
          backdropFilter: 'blur(18px)',
          border: '1px solid rgba(255,255,255,0.22)',
          boxShadow: '0 22px 55px rgba(0,0,0,0.32)',
        }}
      >
        <Typography fontWeight={950}>遮板浮层</Typography>
        <Typography variant="caption" color="rgba(244,251,255,0.7)">只保留答案要点，不挡会议主画面</Typography>
        <Box sx={{ mt: 1, display: 'grid', gap: 0.7 }}>
          {['先讲业务价值', '再讲技术链路', '最后补效果指标'].map((line) => (
            <Box key={line} sx={{ height: 22, borderRadius: 1, bgcolor: 'rgba(125,211,252,0.22)', px: 1, display: 'flex', alignItems: 'center' }}>
              <Typography variant="caption">{line}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}
