# Findings
Dependencies are not installed; Next.js guides must be read after installation.
Existing ledger uses amount_minor, occurred_on and balance_minor. DELETE trigger already reverses all transaction types atomically. Paid needs an RPC with row locking and updated_at guard. Components use CSS modules; preserve structure and add Tailwind action styles.
Next 16.3 local server-actions and revalidatePath docs read. Existing RLS and balance trigger reused. PostgreSQL pg_ctl required elevation after restricted-token error; isolated cluster works.
Large selections (>100 IDs) use delete_transactions RPC to avoid PostgREST URL limits; smaller selections use eq/in. Existing schema stores completed BNPL as paid_installments=total_installments with is_active=false. Deleting a payment preserves schedule/count. No live Supabase credentials/configuration present; tests used isolated PostgreSQL and component handlers.
