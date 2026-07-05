insert into public.admin_app_config (key, value, is_secret)
values (
  'seo',
  '{
    "siteUrl": "https://mianshizhu.cn",
    "sitemapUrl": "https://mianshizhu.cn/sitemap.xml",
    "googleSiteUrl": "https://mianshizhu.cn/",
    "indexNowHost": "mianshizhu.cn",
    "indexNowKey": "b3e625447e10bd10977cdc2faafa3b38",
    "indexNowKeyLocation": "https://mianshizhu.cn/b3e625447e10bd10977cdc2faafa3b38.txt"
  }'::jsonb,
  true
)
on conflict (key) do update
set value = public.admin_app_config.value || excluded.value,
    is_secret = true,
    updated_at = now();
