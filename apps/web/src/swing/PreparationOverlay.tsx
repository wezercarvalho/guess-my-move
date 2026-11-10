import { useEffect, useState, type RefObject } from 'react'
import { containRect, type Rect } from '../round/handOverlay.js'

/** Match the guides to the actual contained image, including letterboxing. */
export function PreparationOverlay({ videoRef }: { videoRef: RefObject<HTMLVideoElement | null> }) {
    const [area, setArea] = useState<Rect | null>(null)
    useEffect(() => {
        const video = videoRef.current
        if (!video) return
        const measure = () => {
            if (video.videoWidth > 0 && video.clientWidth > 0)
                setArea(containRect(video.clientWidth, video.clientHeight, video.videoWidth, video.videoHeight))
        }
        video.addEventListener('loadedmetadata', measure)
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
        observer?.observe(video)
        measure()
        return () => { video.removeEventListener('loadedmetadata', measure); observer?.disconnect() }
    }, [videoRef])
    if (!area) return null
    return <div className="swing-camera-guides" aria-hidden="true" style={{left:area.x,top:area.y,width:area.width,height:area.height,right:'auto',bottom:'auto'}}>
        <span className="swing-face-guide" />
        <span className="swing-hand-guide swing-hand-guide--left">Esq.</span>
        <span className="swing-hand-guide swing-hand-guide--right">Dir.</span>
    </div>
}
