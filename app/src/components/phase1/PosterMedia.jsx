import { formatCanvaEmbedUrl } from '../../lib/canva-embed'

function PosterMedia({
  poster,
  className = '',
  imageClassName = 'w-full h-full object-cover',
  iframeClassName = 'absolute inset-0 w-full h-full border-0',
  title = '캠페인 포스터',
}) {
  if (!poster) return null
  const canvaUrl = poster.canvaUrl || poster.posterCanvaUrl
  if (canvaUrl) {
    return (
      <div className={`relative bg-white ${className}`}>
        <iframe
          src={formatCanvaEmbedUrl(canvaUrl)}
          allowFullScreen
          allow="fullscreen"
          className={iframeClassName}
          title={title}
        />
      </div>
    )
  }
  if (poster.imageUrl) {
    return (
      <img
        src={poster.imageUrl}
        alt={poster.caption || title}
        className={imageClassName}
        loading="lazy"
      />
    )
  }
  return null
}

export default PosterMedia
