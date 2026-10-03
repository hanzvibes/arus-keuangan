create index transaction_receipts_scan_idx
  on public.transaction_receipts(user_id, scan_id);
