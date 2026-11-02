import { PackageSearch, Plus, Search, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { EmptyState, Spinner } from '@/components/ui/Feedback'
import { GlassPanel } from '@/components/ui/GlassPanel'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/components/ui/Toast'
import { useAsync } from '@/hooks/common'
import { useT } from '@/lib/i18n'
import { listCategories } from '@/services/market'

/** Buy & Sell home (Phase 1: foundation). Listings, search and deals arrive in the next phases. */
export default function MarketHomePage() {
  const toast = useToast()
  const { lang } = useT()
  const { data: cats, loading } = useAsync(listCategories, [])
  const soon = () => toast.show('Coming soon')

  return (
    <>
      <PageHeader title="Buy & Sell" back />
      <div className="stack">
        <button type="button" className="glass row" onClick={soon} style={{ padding: '12px 14px', borderRadius: 14, width: '100%', textAlign: 'left' }}>
          <Search size={18} aria-hidden />
          <span className="muted grow">Search products and services</span>
        </button>

        <GlassPanel padded className="row" style={{ gap: 12 }}>
          <ShieldCheck size={24} color="var(--accent)" aria-hidden style={{ flex: 'none' }} />
          <span className="small muted">
            DealSafe is coming. For now you can browse categories. Payments are not available in the app yet, so any deal is between you and the other person.
          </span>
        </GlassPanel>

        <h2 className="section-title">Categories</h2>
        {loading ? <Spinner label="Loading" /> : null}
        {cats === null && !loading ? (
          <GlassPanel padded><p className="small muted">Buy &amp; Sell will be available after the next database update.</p></GlassPanel>
        ) : null}
        {cats ? (
          <div className="chip-row">
            {cats.map((c) => (
              <button key={c.id} type="button" className="chip" onClick={soon}>
                {lang === 'bn' && c.name_bn ? c.name_bn : c.name}
              </button>
            ))}
          </div>
        ) : null}

        <h2 className="section-title">Latest listings</h2>
        <EmptyState icon={<PackageSearch size={28} />} title="No listings yet" body="Products will appear here once selling opens." />

        <div className="form-actions">
          <Button variant="primary" onClick={soon}><Plus size={18} aria-hidden /> Sell something</Button>
        </div>
      </div>
    </>
  )
}
