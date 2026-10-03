export function FinanceLoading() {
  return <div className="finance-loading" role="status" aria-label="Memuat catatan keuangan">
    <span className="sr-only">Memuat catatan keuangan…</span>
    <div className="loading-balance skeleton"><span /><span /><span /></div>
    <div className="loading-actions"><span className="skeleton" /><span className="skeleton" /><span className="skeleton" /></div>
    <div className="loading-grid"><div className="skeleton" /><div className="skeleton" /></div>
  </div>;
}
