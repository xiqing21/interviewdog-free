-- V4 Flash handles the text returned by the local OCR pipeline.
-- Preserve a deliberately customized provider configuration.
update public.admin_app_config
set value = jsonb_set(
  jsonb_set(value, '{textModel}', '"deepseek-v4-flash"'::jsonb),
  '{visionModel}', '"deepseek-v4-flash"'::jsonb
)
where key = 'ai'
  and value ->> 'baseUrl' = 'https://api.deepseek.com/v1'
  and value ->> 'textModel' in ('deepseek-chat', 'deepseek-reasoner');
