/**
 * InterviewPage v2 — 面试辅助主页面
 * 集成 Session 管理、回答模式切换、语音控制、手动触发
 */

import { useState, useCallback, useEffect, useRef, type ChangeEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Switch,
  TextField,
  Typography,
  type SelectChangeEvent,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer';
import HearingIcon from '@mui/icons-material/Hearing';
import TuneIcon from '@mui/icons-material/Tune';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { Link } from 'react-router-dom';
import { VoiceControl } from './VoiceControl';
import { QACard } from './QACard';
import { SessionManager } from './SessionManager';
import { AnswerModeToggle } from './AnswerModeToggle';
import { MarkdownRenderer } from '../common/MarkdownRenderer';
import { INTERVIEW_FOCUS_OPTIONS, INTERVIEW_ROLE_PRESETS, SPEAKER_AUDIO_SOURCES } from '../../constants';
import { useSettings } from '../../hooks/useSettings';
import { useInterview } from '../../hooks/useInterview';
import { useSession } from '../../hooks/useSession';
import { useKnowledge } from '../../hooks/useKnowledge';
import { isPdfFile, MAX_PDF_SIZE, parsePdf } from '../../services/pdfParserService';
import type { ASRProvider, SpeakerAudioSource } from '../../types';

export function InterviewPage() {
  const {
    aiSettings,
    appSettings,
    setASRProvider,
    setMyAudioSource,
    setInterviewerAudioSource,
    updateAppSettings,
  } = useSettings();
  const { activeSession, sessionSummaries } = useSession();
  const {
    isProcessing,
    isListening,
    interimText,
    systemAudioReady,
    transcriptLines,
    qaList,
    addManualQuestion,
    triggerLatestTranscriptQuestion,
    prepareSystemAudioShare,
    deleteQuestion,
    generateReview,
    endInterview,
  } = useInterview();
  const [manualInput, setManualInput] = useState('');
  const [showSetup, setShowSetup] = useState(!activeSession);
  const [showStartPrompt, setShowStartPrompt] = useState(Boolean(activeSession));
  const [setupMode, setSetupMode] = useState<'new' | 'edit'>('new');
  const [selectedQaId, setSelectedQaId] = useState<string | null>(null);
  const lastQaCountRef = useRef(qaList.length);

  useEffect(() => {
    lastQaCountRef.current = qaList.length;
    setManualInput('');
    setSelectedQaId(qaList[qaList.length - 1]?.id ?? null);
  }, [activeSession?.id]);

  useEffect(() => {
    if (qaList.length === 0) {
      setSelectedQaId(null);
      lastQaCountRef.current = 0;
      return;
    }
    const hasNewQuestion = qaList.length > lastQaCountRef.current;
    if (hasNewQuestion || !selectedQaId || !qaList.some((qa) => qa.id === selectedQaId)) {
      setSelectedQaId(qaList[qaList.length - 1].id);
    }
    lastQaCountRef.current = qaList.length;
  }, [qaList, selectedQaId]);

  const handleManualSend = useCallback(() => {
    const q = manualInput.trim();
    if (!q || isProcessing || !activeSession) return;
    addManualQuestion(q);
    setManualInput('');
  }, [manualInput, isProcessing, activeSession, addManualQuestion]);

  const handleTranscriptQuestion = useCallback((question: string) => {
    if (!question.trim() || isProcessing || !aiSettings.apiKey) return;
    void addManualQuestion(question.trim());
  }, [addManualQuestion, aiSettings.apiKey, isProcessing]);

  const handleInterviewerAudioSourceChange = useCallback((source: SpeakerAudioSource) => {
    setInterviewerAudioSource(source);
    if (source === 'system') {
      void prepareSystemAudioShare();
    }
  }, [prepareSystemAudioShare, setInterviewerAudioSource]);

  const selectedQa = selectedQaId
    ? qaList.find((qa) => qa.id === selectedQaId) ?? null
    : qaList[qaList.length - 1] ?? null;
  const visibleQaList = [...qaList].reverse();
  const hasTriggerableInterviewerText =
    transcriptLines.some((line) => line.speaker === 'interviewer') ||
    /^面试官[：:]/.test(interimText.trim());

  if (showStartPrompt && activeSession && !showSetup) {
    return (
      <ProjectStartPrompt
        activeName={activeSession.name}
        sessionCount={sessionSummaries.length}
        onContinue={() => setShowStartPrompt(false)}
        onCreate={() => {
          setSetupMode('new');
          setShowSetup(true);
          setShowStartPrompt(false);
        }}
      />
    );
  }

  if (showSetup || !activeSession) {
    return (
      <Box sx={{ maxWidth: 980, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {!aiSettings.apiKey && (
          <Alert severity="warning" action={<Button color="inherit" size="small" component={Link} to="/settings">前往设置</Button>}>
            可以先准备项目和简历；正式生成答案前仍需配置 API Key。
          </Alert>
        )}
        <InterviewSetup mode={setupMode} onDone={() => setShowSetup(false)} />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          md: '180px minmax(0, 1fr) 220px',
          xl: '260px minmax(0, 1fr) 300px',
        },
        gap: 2,
        alignItems: 'start',
      }}
    >
      <Paper key={`answer-${activeSession.id}`} sx={{ p: 2, minHeight: { md: 'calc(100vh - 140px)' } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <QuestionAnswerIcon color="primary" fontSize="small" />
          <Typography variant="subtitle1" fontWeight={700}>面试官问题</Typography>
          <Chip size="small" label={qaList.length} sx={{ ml: 'auto' }} />
        </Box>

        <SessionManager />
        <Button
          fullWidth
          size="small"
          variant="outlined"
          sx={{ mt: 1.5 }}
          onClick={() => {
            setSetupMode('edit');
            setShowSetup(true);
          }}
        >
          项目准备 / 简历岗位
        </Button>

        <Box sx={{ mt: 2, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          {activeSession.targetRole && <Chip size="small" label={activeSession.targetRole} />}
          {activeSession.focusAreas?.map((focus) => <Chip key={focus} size="small" label={focus} variant="outlined" />)}
        </Box>

        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {qaList.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              识别到的问题会出现在这里。
            </Typography>
          ) : (
            visibleQaList.map((qa, index) => {
              const selected = qa.id === selectedQa?.id;
              const questionNumber = qaList.findIndex((item) => item.id === qa.id) + 1;
              return (
                <Box
                key={qa.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedQaId(qa.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedQaId(qa.id);
                  }
                }}
                sx={{
                  p: 1.1,
                  borderRadius: 1,
                  border: '1px solid',
                  borderColor: selected ? 'primary.main' : 'divider',
                  bgcolor: selected ? 'action.selected' : 'background.paper',
                  cursor: 'pointer',
                  transition: 'border-color 120ms ease, background-color 120ms ease',
                  '&:hover': {
                    borderColor: selected ? 'primary.main' : 'text.secondary',
                  },
                }}
              >
                <Typography variant="caption" color={selected ? 'primary.main' : 'text.secondary'}>
                  {index === 0 ? '最新问题' : `第 ${questionNumber} 题`}
                </Typography>
                <IconButton
                  size="small"
                  color="error"
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteQuestion(qa.id);
                  }}
                  disabled={isProcessing}
                  sx={{ float: 'right', width: 24, height: 24, mt: -0.5 }}
                  aria-label="删除问题"
                >
                  <DeleteOutlineIcon fontSize="inherit" />
                </IconButton>
                <Typography variant="body2" sx={{ mt: 0.25 }} noWrap title={qa.question}>
                  {qa.question}
                </Typography>
              </Box>
              );
            })
          )}
        </Box>
      </Paper>

      <Paper sx={{ p: 2, minHeight: { md: 'calc(100vh - 140px)' } }}>
        {!aiSettings.apiKey && (
          <Alert severity="warning" sx={{ mb: 2 }} action={<Button color="inherit" size="small" component={Link} to="/settings">前往设置</Button>}>
            需要配置 API Key 后才能生成答案。
          </Alert>
        )}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Typography variant="h6" fontWeight={800}>AI 回答</Typography>
          {isProcessing && <Chip size="small" color="primary" label="生成中" />}
          {isListening && <Chip size="small" color="success" label="识别中" />}
          {activeSession.archivedAt && <Chip size="small" color="default" label="已归档" />}
        </Box>

        {!selectedQa ? (
          <Box sx={{ py: 8, textAlign: 'center', color: 'text.secondary' }}>
            <HearingIcon sx={{ fontSize: 48, mb: 1, opacity: 0.6 }} />
            <Typography variant="subtitle1">等待第一道面试问题</Typography>
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              开始语音识别，或在右侧手动输入问题。
            </Typography>
          </Box>
        ) : (
          <QACard qa={selectedQa} />
        )}

        {activeSession.archivedAt && activeSession.review?.summary && (
          <Box sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="subtitle2" fontWeight={700}>面试复盘</Typography>
              <Button
                size="small"
                variant="outlined"
                onClick={() => { void generateReview(); }}
                disabled={isProcessing || !aiSettings.apiKey}
                sx={{ ml: 'auto' }}
              >
                重新生成复盘总结
              </Button>
            </Box>
            <MarkdownRenderer content={activeSession.review.summary} />
          </Box>
        )}

        {activeSession.archivedAt && !activeSession.review?.summary && (
          <Button
            fullWidth
            variant="outlined"
            sx={{ mt: 2 }}
            onClick={() => { void generateReview(); }}
            disabled={isProcessing || !aiSettings.apiKey}
          >
            生成复盘总结
          </Button>
        )}
      </Paper>

      <Paper sx={{ p: 2, minHeight: { md: 'calc(100vh - 140px)' } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <TuneIcon color="primary" fontSize="small" />
          <Typography variant="subtitle1" fontWeight={700}>双方对话记录</Typography>
        </Box>

        <Box
          sx={{
            p: 1.5,
            borderRadius: 1,
            border: '1px solid',
            borderColor: 'divider',
            bgcolor: 'background.paper',
            mb: 2,
            height: { xs: 260, md: '34vh' },
            minHeight: 240,
            overflowY: 'auto',
          }}
        >
          {interimText && (
            <Box
              sx={{
                mb: 1,
                p: 1,
                borderRadius: 1,
                bgcolor: 'action.hover',
                border: '1px dashed',
                borderColor: 'divider',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
                <Chip size="small" label="识别中" />
              </Box>
              <Typography variant="body2" sx={{ lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {interimText}
              </Typography>
            </Box>
          )}
          {transcriptLines.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              双路转写会记录在这里：我说的话只留档，面试官问题会触发 AI。
            </Typography>
          ) : (
            transcriptLines.slice(-30).map((line) => (
              <Box
                key={line.id}
                sx={{
                  mb: 1,
                  p: 1,
                  borderRadius: 1,
                  bgcolor: line.speaker === 'interviewer' ? 'rgba(98, 179, 255, 0.12)' : 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid',
                  borderColor: line.speaker === 'interviewer' ? 'primary.dark' : 'divider',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.35 }}>
                  <Chip
                    size="small"
                    color={line.speaker === 'interviewer' ? 'primary' : 'default'}
                    label={line.speaker === 'interviewer' ? '面试官' : '我'}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {formatTime(line.timestamp)}
                  </Typography>
                  {line.speaker === 'interviewer' && (
                    <Button
                      size="small"
                      variant="text"
                      onClick={() => handleTranscriptQuestion(line.text)}
                      disabled={isProcessing || !aiSettings.apiKey}
                      sx={{ minWidth: 0, px: 0.75 }}
                    >
                      触发
                    </Button>
                  )}
                </Box>
                <Typography variant="body2" sx={{ lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {line.text}
                </Typography>
              </Box>
            ))
          )}
        </Box>

        <Button
          fullWidth
          variant="outlined"
          sx={{ mb: 1.5 }}
          onClick={() => { void triggerLatestTranscriptQuestion(); }}
          disabled={isProcessing || !aiSettings.apiKey || !hasTriggerableInterviewerText}
        >
          用当前/最近面试官问题触发
        </Button>

        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="手动输入或修正面试官问题..."
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleManualSend(); }}}
            multiline
            maxRows={4}
          />
          <IconButton
            color="primary"
            onClick={handleManualSend}
            disabled={!manualInput.trim() || isProcessing || !aiSettings.apiKey}
            sx={{ alignSelf: 'flex-end' }}
          >
            <SendIcon />
          </IconButton>
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
          <Chip size="small" label={asrProviderLabel(appSettings.asrProvider)} />
          <Chip size="small" label={`我：${sourceLabel(appSettings.myAudioSource)}`} />
          <Chip size="small" label={`面试官：${sourceLabel(appSettings.interviewerAudioSource)}`} />
          {appSettings.interviewerAudioSource === 'system' && (
            <Chip
              size="small"
              color={systemAudioReady ? 'success' : 'warning'}
              label={systemAudioReady ? '系统音频已共享' : '系统音频未共享'}
            />
          )}
        </Box>

        <Alert severity="info" sx={{ mb: 2 }}>
          面试官选择“系统音频”时，点击开始会弹出 Chrome 的共享窗口/屏幕/标签页选择器；请选择腾讯会议或整个屏幕，并勾选共享音频。
        </Alert>

        {appSettings.interviewerAudioSource === 'system' && (
          <Button
            fullWidth
            variant={systemAudioReady ? 'outlined' : 'contained'}
            sx={{ mb: 2 }}
            onClick={() => { void prepareSystemAudioShare(); }}
            disabled={isListening}
          >
            {systemAudioReady ? '重新共享系统音频' : '先共享系统音频'}
          </Button>
        )}

        {appSettings.interviewerAudioSource === 'system' && appSettings.asrProvider === 'browser' && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            浏览器 ASR 只能识别麦克风，不能识别共享出来的系统音频。要识别微信/腾讯会议播放的面试官声音，请把识别引擎切到豆包 ASR 或 OpenAI 分片识别。
          </Alert>
        )}

        {appSettings.interviewerAudioSource === 'system' && appSettings.asrProvider === 'openai' && (
          <Alert severity="info" sx={{ mb: 2 }}>
            OpenAI 分片识别会使用已共享的系统音频，识别结果固定按“面试官”记录并自动触发答案，延迟约 4-6 秒。
          </Alert>
        )}

        {appSettings.asrProvider === 'local-qwen' && (
          <Alert severity="info" sx={{ mb: 2 }}>
            本地 Qwen3-ASR 会连接你电脑上的 MLX 服务；先在设置里测试连通，再开始面试。
          </Alert>
        )}

        <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
          <InputLabel>我的声音</InputLabel>
          <Select
            label="我的声音"
            value={appSettings.myAudioSource}
            onChange={(event: SelectChangeEvent) => setMyAudioSource(event.target.value as SpeakerAudioSource)}
            disabled={isListening}
          >
            {SPEAKER_AUDIO_SOURCES.map((source) => (
              <MenuItem key={source.key} value={source.key}>{source.label}</MenuItem>
            ))}
          </Select>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
            {SPEAKER_AUDIO_SOURCES.find((source) => source.key === appSettings.myAudioSource)?.desc}
          </Typography>
        </FormControl>

        <FormControl fullWidth size="small" sx={{ mb: 1.5 }}>
          <InputLabel>面试官声音</InputLabel>
          <Select
            label="面试官声音"
            value={appSettings.interviewerAudioSource}
            onChange={(event: SelectChangeEvent) => handleInterviewerAudioSourceChange(event.target.value as SpeakerAudioSource)}
            disabled={isListening}
          >
            {SPEAKER_AUDIO_SOURCES.map((source) => (
              <MenuItem key={source.key} value={source.key}>{source.label}</MenuItem>
            ))}
          </Select>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
            {SPEAKER_AUDIO_SOURCES.find((source) => source.key === appSettings.interviewerAudioSource)?.desc}
          </Typography>
        </FormControl>

        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>识别引擎</InputLabel>
          <Select
            label="识别引擎"
            value={appSettings.asrProvider}
            onChange={(event: SelectChangeEvent) => setASRProvider(event.target.value as ASRProvider)}
            disabled={isListening}
          >
            <MenuItem value="doubao">豆包 ASR（推荐识别面试官系统音频）</MenuItem>
            <MenuItem value="local-qwen">本地 Qwen3-ASR（MLX）</MenuItem>
            <MenuItem value="openai">OpenAI Whisper（系统音频备用）</MenuItem>
            <MenuItem value="browser">浏览器 ASR（适合麦克风）</MenuItem>
          </Select>
        </FormControl>

        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel>句内停顿容忍</InputLabel>
          <Select
            label="句内停顿容忍"
            value={String(appSettings.mergeTimeoutMs)}
            onChange={(event: SelectChangeEvent) => updateAppSettings({ mergeTimeoutMs: Number(event.target.value) })}
          >
            <MenuItem value="1000">1.0 秒</MenuItem>
            <MenuItem value="1500">1.5 秒</MenuItem>
            <MenuItem value="2000">2.0 秒</MenuItem>
            <MenuItem value="2500">2.5 秒</MenuItem>
            <MenuItem value="5000">5.0 秒</MenuItem>
            <MenuItem value="8000">8.0 秒</MenuItem>
            <MenuItem value="12000">12.0 秒</MenuItem>
          </Select>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
            面试中可随时调整，新的识别片段会按当前值合并触发。
          </Typography>
        </FormControl>

        <FormControlLabel
          control={
            <Switch
              checked={appSettings.webSearchEnabled}
              onChange={(event) => updateAppSettings({ webSearchEnabled: event.target.checked })}
            />
          }
          label="回答失败时联网搜索补充"
          sx={{ mb: 1 }}
        />
        {appSettings.webSearchEnabled && (
          <Alert severity="info" sx={{ mb: 2 }}>
            正常先用简历和知识库回答；如果模型生成失败，会自动搜索网页摘要后重试一次。
          </Alert>
        )}

        <AnswerModeToggle />
        <VoiceControl />

        <Button
          fullWidth
          color="error"
          variant="contained"
          sx={{ mt: 1.5 }}
          onClick={() => { void endInterview(); }}
          disabled={isProcessing || Boolean(activeSession.archivedAt)}
        >
          结束面试并归档
        </Button>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>
          自动没触发时，可用最近面试官转写触发；也可手动修正问题后 Enter 发送。
        </Typography>
      </Paper>
    </Box>
  );
}

function sourceLabel(source: SpeakerAudioSource): string {
  if (source === 'system') return '系统音频';
  if (source === 'microphone') return '麦克风';
  return '静音';
}

function asrProviderLabel(provider: ASRProvider): string {
  if (provider === 'doubao') return '豆包 ASR';
  if (provider === 'local-qwen') return '本地 Qwen3-ASR';
  if (provider === 'openai') return 'OpenAI 分片 ASR';
  return '浏览器 ASR';
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

interface ProjectStartPromptProps {
  activeName: string;
  sessionCount: number;
  onContinue: () => void;
  onCreate: () => void;
}

function ProjectStartPrompt({
  activeName,
  sessionCount,
  onContinue,
  onCreate,
}: ProjectStartPromptProps) {
  return (
    <Box sx={{ maxWidth: 760, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" fontWeight={800} gutterBottom>
          开始一场新的面试吗？
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          当前有 {sessionCount} 个项目。上次项目是「{activeName}」，你可以继续它，也可以先新建一个项目再开始。
        </Typography>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button variant="contained" size="large" onClick={onCreate}>
            新建面试项目
          </Button>
          <Button variant="outlined" size="large" onClick={onContinue}>
            继续上次项目
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}

interface InterviewSetupProps {
  mode: 'new' | 'edit';
  onDone: () => void;
}

function InterviewSetup({ mode, onDone }: InterviewSetupProps) {
  const { activeSession, createSession, resume, jd, updateSessionProfile, updateSessionName } = useSession();
  const { profile: knowledgeProfile } = useKnowledge();
  const editing = mode === 'edit' && Boolean(activeSession);
  const currentRole = INTERVIEW_ROLE_PRESETS.find((role) => role.label === (editing ? activeSession?.targetRole : undefined));
  const newestResume = [...knowledgeProfile.resumes].sort((a, b) => b.updatedAt - a.updatedAt)[0];
  const composeResumeText = useCallback((resumeIds: string[]) => {
    const selected = resumeIds
      .map((id) => knowledgeProfile.resumes.find((item) => item.id === id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    return selected
      .map((item) => `### ${item.name}\n${item.content}`)
      .join('\n\n');
  }, [knowledgeProfile.resumes]);
  const [projectName, setProjectName] = useState(editing ? activeSession?.name ?? '' : '');
  const [selectedRole, setSelectedRole] = useState(currentRole?.key ?? INTERVIEW_ROLE_PRESETS[0].key);
  const [selectedResumeIds, setSelectedResumeIds] = useState<string[]>(editing || !newestResume ? [] : [newestResume.id]);
  const [resumeText, setResumeText] = useState(
    editing
      ? activeSession?.resume ?? resume
      : newestResume
        ? composeResumeText([newestResume.id])
        : resume,
  );
  const [jdText, setJdText] = useState(
    editing
      ? (activeSession?.jd ?? jd) || currentRole?.jd || INTERVIEW_ROLE_PRESETS[0].jd
      : currentRole?.jd || INTERVIEW_ROLE_PRESETS[0].jd,
  );
  const [focusAreas, setFocusAreas] = useState<string[]>(
    editing && activeSession?.focusAreas?.length ? activeSession.focusAreas : ['SQL', '项目深挖'],
  );
  const [error, setError] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

  const handleRoleChange = (event: SelectChangeEvent) => {
    const nextRole = event.target.value;
    const preset = INTERVIEW_ROLE_PRESETS.find((role) => role.key === nextRole);
    setSelectedRole(nextRole as typeof selectedRole);
    if (preset) {
      setProjectName((current) => current || preset.label);
      setJdText(preset.jd);
      if (preset.key === 'web3') setFocusAreas(['Web3', '系统设计', '项目深挖']);
      if (preset.key === 'bigdata') setFocusAreas(['SQL', '大数据', '项目深挖']);
    }
  };

  const handleResumeLibraryChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    const resumeIds = typeof value === 'string' ? value.split(',') : value;
    setSelectedResumeIds(resumeIds);
    setResumeText(resumeIds.length ? composeResumeText(resumeIds) : '');
  };

  const handleResumeUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    if (!isPdfFile(file)) {
      setError('仅支持 PDF 格式的简历文件。');
      return;
    }
    if (file.size > MAX_PDF_SIZE) {
      setError(`文件过大，最大支持 ${MAX_PDF_SIZE / 1024 / 1024}MB。`);
      return;
    }

    setLoadingPdf(true);
    try {
      setResumeText(await parsePdf(file));
      setSelectedResumeIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PDF 解析失败');
    } finally {
      setLoadingPdf(false);
      event.target.value = '';
    }
  };

  const toggleFocus = (focus: string) => {
    setFocusAreas((current) =>
      current.includes(focus)
        ? current.filter((item) => item !== focus)
        : [...current, focus],
    );
  };

  const startProject = () => {
    const role = INTERVIEW_ROLE_PRESETS.find((item) => item.key === selectedRole);
    const profile = {
      resume: resumeText,
      jd: jdText,
      targetRole: role?.label ?? '',
      focusAreas,
    };
    if (editing && activeSession) {
      updateSessionProfile(profile);
      updateSessionName(activeSession.id, projectName.trim() || role?.label || activeSession.name);
    } else {
      createSession(projectName.trim() || role?.label || '面试项目', profile);
    }
    onDone();
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h5" fontWeight={800} gutterBottom>
        {editing ? '项目准备：简历与岗位' : '第一步：准备新的面试项目'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        先创建项目，放入简历和岗位方向；第二步进入项目后再开始识别面试官问题并生成答案。
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        <TextField
          label="项目名称"
          value={projectName}
          onChange={(event) => setProjectName(event.target.value)}
          placeholder="例如：大数据开发一面"
        />
        <FormControl>
          <InputLabel>职位方向</InputLabel>
          <Select label="职位方向" value={selectedRole} onChange={handleRoleChange}>
            {INTERVIEW_ROLE_PRESETS.map((role) => (
              <MenuItem key={role.key} value={role.key}>{role.label}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      <Typography variant="subtitle2" sx={{ mt: 2, mb: 1 }}>考察方向</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        {INTERVIEW_FOCUS_OPTIONS.map((focus) => (
          <Chip
            key={focus}
            label={focus}
            color={focusAreas.includes(focus) ? 'primary' : 'default'}
            variant={focusAreas.includes(focus) ? 'filled' : 'outlined'}
            onClick={() => toggleFocus(focus)}
          />
        ))}
      </Box>

      <Box sx={{ mt: 2, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        {knowledgeProfile.resumes.length > 0 && (
          <FormControl size="small" sx={{ minWidth: 260 }}>
            <InputLabel>引用简历库（可多选）</InputLabel>
            <Select
              multiple
              label="引用简历库（可多选）"
              value={selectedResumeIds}
              onChange={handleResumeLibraryChange}
              renderValue={(selected) => {
                const names = selected
                  .map((id) => knowledgeProfile.resumes.find((item) => item.id === id)?.name)
                  .filter(Boolean);
                return names.length ? names.join('、') : '临时粘贴/上传内容';
              }}
            >
              {knowledgeProfile.resumes.map((item) => (
                <MenuItem key={item.id} value={item.id}>
                  <Checkbox checked={selectedResumeIds.includes(item.id)} />
                  <ListItemText
                    primary={item.name}
                    secondary={`${item.content.length.toLocaleString('zh-CN')} 字`}
                  />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <Button variant="outlined" component="label" startIcon={<UploadFileIcon />} disabled={loadingPdf}>
          {loadingPdf ? '解析中...' : '上传 PDF 简历'}
          <input type="file" accept=".pdf" hidden onChange={handleResumeUpload} />
        </Button>
        <Typography variant="caption" color="text.secondary">
          已有简历库会默认引用最近一份；可多选引用，上传或手动编辑会改为临时内容。
        </Typography>
      </Box>

      <TextField
        fullWidth
        multiline
        minRows={5}
        maxRows={12}
        label="简历文本"
        value={resumeText}
        onChange={(event) => {
          setSelectedResumeIds([]);
          setResumeText(event.target.value);
        }}
        placeholder="粘贴你的简历，或上传 PDF 自动解析..."
        sx={{ mt: 2 }}
      />

      <TextField
        fullWidth
        multiline
        minRows={4}
        maxRows={10}
        label="岗位描述 / 面试目标"
        value={jdText}
        onChange={(event) => setJdText(event.target.value)}
        sx={{ mt: 2 }}
      />

      <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
        {editing && (
          <Button sx={{ mr: 1 }} onClick={onDone}>
            返回工作台
          </Button>
        )}
        <Button variant="contained" size="large" onClick={startProject}>
          {editing ? '保存并返回工作台' : '第二步：进入面试工作台'}
        </Button>
      </Box>
    </Paper>
  );
}
