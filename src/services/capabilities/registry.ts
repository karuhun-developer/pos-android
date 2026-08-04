/** Kemampuan opsional yang bisa "dipasang" (mis. printer thermal, scanner). */
export interface Capability {
  readonly id: string
  isAvailable(): Promise<boolean>
}

export interface ReceiptLine {
  text: string
  align?: 'left' | 'center' | 'right'
  bold?: boolean
  size?: 'normal' | 'large'
}

export interface ReceiptJob {
  title: string
  lines: ReceiptLine[]
  /** HTML lengkap struk buat preview/print web. */
  html?: string
}

export interface PrinterDevice {
  id: string
  name: string
}

export interface PrinterCapability extends Capability {
  readonly id: 'printer'
  print(job: ReceiptJob): Promise<void>
  listDevices?(): Promise<PrinterDevice[]>
}

/** Registry runtime. Core cuma tanya registry, gak pernah import plugin konkret. */
export class CapabilityRegistry {
  private caps = new Map<string, Capability>()

  register<T extends Capability>(cap: T): void {
    this.caps.set(cap.id, cap)
  }

  get<T extends Capability>(id: string): T | null {
    return (this.caps.get(id) as T) ?? null
  }

  async has(id: string): Promise<boolean> {
    const cap = this.caps.get(id)
    return cap ? cap.isAvailable() : false
  }
}

export const capabilities = new CapabilityRegistry()
