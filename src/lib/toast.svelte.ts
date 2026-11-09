// One toast at a time, shared by every view so Saved and Seen can offer Undo like Discover does.
class ToastStore {
  #current = $state<{ id: number; message: string } | null>(null)
  #seq = 0

  get current(): { id: number; message: string } | null {
    return this.#current
  }

  show(message: string): void {
    this.#current = { id: ++this.#seq, message }
  }

  clear(): void {
    this.#current = null
  }
}

export const toast = new ToastStore()
