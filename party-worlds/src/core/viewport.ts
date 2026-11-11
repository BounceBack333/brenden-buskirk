/**
 * Always-landscape presentation.
 *
 * The game is designed for landscape. If the window is portrait (a phone held upright, or an
 * embedded web view that cannot rotate), the whole stage is rotated 90° with CSS so the player
 * simply turns the phone — no dependence on the OS orientation lock. A tall window on a desktop
 * (mouse and keyboard) is not rotated: there the stage is a 16:9 band across the middle.
 * All pointer coordinates are converted into "stage space" here; nothing else in the game needs
 * to know.
 */
export interface StageSize {
  width: number;
  height: number;
  rotated: boolean;
}

export class Viewport {
  size: StageSize = { width: 1280, height: 720, rotated: false };
  private listeners = new Set<(s: StageSize) => void>();
  private pending = 0;
  /** a touch-first device: the only kind worth turning on its side */
  private handheld = typeof window === 'undefined' || !window.matchMedia || window.matchMedia('(pointer: coarse)').matches;
  /** top of the stage in client pixels (letterboxed desktop windows) */
  private top = 0;

  constructor(readonly root: HTMLElement) {
    const onResize = (): void => {
      cancelAnimationFrame(this.pending);
      this.pending = requestAnimationFrame(() => this.apply());
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    window.visualViewport?.addEventListener('resize', onResize);
    this.apply();
  }

  onChange(fn: (s: StageSize) => void): () => void {
    this.listeners.add(fn);
    fn(this.size);
    return () => this.listeners.delete(fn);
  }

  private apply(): void {
    const vw = Math.max(1, window.innerWidth);
    const vh = Math.max(1, window.innerHeight);
    const tall = vh > vw;
    const rotated = tall && this.handheld;
    const width = rotated ? vh : vw;
    // a tall desktop window gets a landscape band rather than a sideways game
    const height = rotated ? vw : tall ? Math.round((vw * 9) / 16) : vh;
    this.top = tall && !rotated ? Math.round((vh - height) / 2) : 0;
    const st = this.root.style;
    st.width = `${width}px`;
    st.height = `${height}px`;
    st.transformOrigin = '0 0';
    st.transform = rotated ? `translateX(${vw}px) rotate(90deg)` : this.top ? `translateY(${this.top}px)` : 'none';
    this.root.classList.toggle('rotated', rotated);
    // expose a size unit for CSS: 1 --u = 1% of the stage's short side
    st.setProperty('--u', `${height / 100}px`);
    this.size = { width, height, rotated };
    for (const fn of this.listeners) fn(this.size);
  }

  /** Client (browser) coordinates → stage coordinates. */
  toStage(clientX: number, clientY: number): { x: number; y: number } {
    if (this.size.rotated) return { x: clientY, y: window.innerWidth - clientX };
    return { x: clientX, y: clientY - this.top };
  }
}
