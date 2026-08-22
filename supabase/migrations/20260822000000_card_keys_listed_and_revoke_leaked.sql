-- Track which unused keys have been imported into the card shop,
-- and revoke the first seed batch that was committed to the public repo.

alter table public.license_card_keys
  add column if not exists listed_at timestamptz,
  add column if not exists listed_channel text;

create index if not exists license_card_keys_listed_idx
  on public.license_card_keys (status, listed_at);

update public.license_card_keys
set
  status = 'revoked',
  note = trim(both '｜' from concat_ws('｜', nullif(note, ''), '已作废：种子卡密曾写入公开仓库，不可售卖')),
  updated_at = now()
where batch_no = 'FAKA-20260821-30M'
  and status = 'unused';
