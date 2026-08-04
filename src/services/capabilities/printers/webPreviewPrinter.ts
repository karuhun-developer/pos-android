import type {
  PrinterCapability,
  ReceiptJob,
} from '@/services/capabilities/registry'

/**
 * Printer default v1: render struk sebagai HTML lalu buka dialog print browser.
 * Bukan hardware — tapi bikin seluruh alur "cetak struk" jalan tanpa plugin.
 * Nanti tinggal daftar ThermalPrinter buat hardware asli, ini jadi fallback.
 */
export class WebPreviewPrinter implements PrinterCapability {
  readonly id = 'printer' as const

  async isAvailable(): Promise<boolean> {
    return typeof window !== 'undefined'
  }

  async print(job: ReceiptJob): Promise<void> {
    const html = job.html ?? this.renderHtml(job)
    const w = window.open('', '_blank', 'width=380,height=640')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => {
      w.print()
    }, 250)
  }

  private renderHtml(job: ReceiptJob): string {
    const body = job.lines
      .map((l) => {
        const align = l.align ?? 'left'
        const weight = l.bold ? '700' : '400'
        const size = l.size === 'large' ? '16px' : '12px'
        return `<div style="text-align:${align};font-weight:${weight};font-size:${size}">${l.text || '&nbsp;'}</div>`
      })
      .join('')
    return `<!doctype html><html><head><meta charset="utf-8"><title>${job.title}</title>
      <style>
        body{font-family:'Courier New',monospace;width:280px;margin:0 auto;padding:12px;color:#000}
        .divider{border-top:1px dashed #000;margin:6px 0}
      </style></head><body>${body}</body></html>`
  }
}
