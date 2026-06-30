import { Paper, TextField, Typography, Box, FormControl, InputLabel, MenuItem, Select, type SelectChangeEvent } from '@mui/material';
import { useSettings } from '../../hooks/useSettings';

const CLOUD_PROVIDERS = ['baidu', 'google', 'alibaba', 'iflytek', 'glm', 'gateway-iflytek', 'gateway-alibaba'];

export function CloudASRConfig() {
  const { appSettings, cloudAsrConfig, updateCloudASRConfig } = useSettings();
  if (!CLOUD_PROVIDERS.includes(appSettings.asrProvider)) return null;

  return (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>云 ASR 配置</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        百度、Google、阿里、讯飞、GLM 均可按本地 PCM 分片识别；Gateway 讯飞/阿里会复用这里的凭证。
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
        <FormControl fullWidth>
          <InputLabel>分片长度</InputLabel>
          <Select
            label="分片长度"
            value={String(cloudAsrConfig.chunkMs)}
            onChange={(event: SelectChangeEvent) => updateCloudASRConfig({ chunkMs: Number(event.target.value) })}
          >
            <MenuItem value="1500">1.5 秒</MenuItem>
            <MenuItem value="2500">2.5 秒</MenuItem>
            <MenuItem value="4000">4 秒</MenuItem>
            <MenuItem value="6000">6 秒</MenuItem>
          </Select>
        </FormControl>
        <TextField
          label="语言"
          value={cloudAsrConfig.language}
          onChange={(event) => updateCloudASRConfig({ language: event.target.value })}
          placeholder="zh-CN"
        />
      </Box>

      {appSettings.asrProvider === 'baidu' && (
        <Box sx={{ mt: 2, display: 'grid', gap: 2 }}>
          <TextField label="百度 API Key" type="password" value={cloudAsrConfig.baiduApiKey} onChange={(e) => updateCloudASRConfig({ baiduApiKey: e.target.value })} />
          <TextField label="百度 Secret Key" type="password" value={cloudAsrConfig.baiduSecretKey} onChange={(e) => updateCloudASRConfig({ baiduSecretKey: e.target.value })} />
        </Box>
      )}

      {appSettings.asrProvider === 'google' && (
        <Box sx={{ mt: 2 }}>
          <TextField fullWidth label="Google API Key" type="password" value={cloudAsrConfig.googleApiKey} onChange={(e) => updateCloudASRConfig({ googleApiKey: e.target.value })} />
        </Box>
      )}

      {(appSettings.asrProvider === 'alibaba' || appSettings.asrProvider === 'gateway-alibaba') && (
        <Box sx={{ mt: 2, display: 'grid', gap: 2 }}>
          <TextField label="阿里云 AppKey" value={cloudAsrConfig.alibabaAppKey} onChange={(e) => updateCloudASRConfig({ alibabaAppKey: e.target.value })} />
          <TextField label="阿里云 Token" type="password" value={cloudAsrConfig.alibabaToken} onChange={(e) => updateCloudASRConfig({ alibabaToken: e.target.value })} />
          <TextField label="Endpoint" value={cloudAsrConfig.alibabaEndpoint} onChange={(e) => updateCloudASRConfig({ alibabaEndpoint: e.target.value })} />
        </Box>
      )}

      {(appSettings.asrProvider === 'iflytek' || appSettings.asrProvider === 'gateway-iflytek') && (
        <Box sx={{ mt: 2, display: 'grid', gap: 2 }}>
          <TextField label="讯飞 AppID" value={cloudAsrConfig.iflytekAppId} onChange={(e) => updateCloudASRConfig({ iflytekAppId: e.target.value })} />
          <TextField label="讯飞 API Key" type="password" value={cloudAsrConfig.iflytekApiKey} onChange={(e) => updateCloudASRConfig({ iflytekApiKey: e.target.value })} />
          <TextField label="讯飞 API Secret" type="password" value={cloudAsrConfig.iflytekApiSecret} onChange={(e) => updateCloudASRConfig({ iflytekApiSecret: e.target.value })} />
        </Box>
      )}

      {appSettings.asrProvider === 'glm' && (
        <Box sx={{ mt: 2, display: 'grid', gap: 2 }}>
          <TextField label="GLM / Z.AI API Key" type="password" value={cloudAsrConfig.glmApiKey} onChange={(e) => updateCloudASRConfig({ glmApiKey: e.target.value })} />
          <TextField label="Base URL" value={cloudAsrConfig.glmBaseUrl} onChange={(e) => updateCloudASRConfig({ glmBaseUrl: e.target.value })} />
          <TextField label="模型" value={cloudAsrConfig.glmModel} onChange={(e) => updateCloudASRConfig({ glmModel: e.target.value })} />
          <TextField label="热词" value={cloudAsrConfig.hotwords} onChange={(e) => updateCloudASRConfig({ hotwords: e.target.value })} placeholder="StarRocks,Flink,Fluss" />
        </Box>
      )}
    </Paper>
  );
}
