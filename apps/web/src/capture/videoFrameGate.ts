/** Transient frame notifications only; this class never owns or records camera media. */
export class VideoFrameGate {
    private video: HTMLVideoElement | null = null
    private handle: number | null = null
    private pending = false
    private lastTime = -1
    private generation = 0
    constructor(private readonly onFrame: (now?: number) => void = () => {}) {}
    watch(video: HTMLVideoElement | null): void {
        this.unwatch()
        if (!video || typeof video.requestVideoFrameCallback !== 'function')
            return
        this.video = video
        const generation = this.generation
        const arm = (): void => {
            this.handle = video.requestVideoFrameCallback(() => {
                if (generation !== this.generation || this.video !== video)
                    return
                this.pending = true
                this.onFrame()
                if (generation === this.generation && this.video === video)
                    arm()
            })
        }
        arm()
    }
    take(video: HTMLVideoElement, now?: number): boolean {
        if (this.video === video) {
            if (!this.pending) return false
            this.pending = false
            return true
        }
        if (video.currentTime === this.lastTime) return false
        this.lastTime = video.currentTime
        this.onFrame(now)
        return true
    }
    unwatch(): void {
        this.generation++
        if (
            this.video &&
            this.handle !== null &&
            typeof this.video.cancelVideoFrameCallback === 'function'
        )
            this.video.cancelVideoFrameCallback(this.handle)
        this.handle = null
        this.video = null
        this.pending = false
        this.lastTime = -1
    }
}
