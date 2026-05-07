import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { ArrowSquareOut, ClipboardText, FileDashed, FileDoc, FilePdf, FileXls, FolderOpen, ImageSquare, SpeakerHigh, Video, WarningCircle } from '@phosphor-icons/react'
import DOMPurify from 'dompurify'
import type { VaultEntry } from '../types'
import { trackFilePreviewAction, trackFilePreviewFailed, trackFilePreviewOpened } from '../lib/productAnalytics'
import { filePreviewKind, previewFileTypeLabel, type FilePreviewKind } from '../utils/filePreview'
import { focusNoteListContainer } from '../utils/neighborhoodHistory'
import { openLocalFile } from '../utils/url'
import { Button } from './ui/button'

interface FilePreviewProps {
  entry: VaultEntry
  onCopyFilePath?: (path: string) => void
  onOpenExternalFile?: (path: string) => void
  onRevealFile?: (path: string) => void
}

interface FilePreviewFallbackProps {
  icon: 'warning' | 'file'
  title: string
  description: string
  onOpenExternal: () => void
}

function fallbackContentForPreviewKind(previewKind: FilePreviewKind | null): Omit<FilePreviewFallbackProps, 'onOpenExternal'> {
  if (previewKind === 'image') {
    return {
      icon: 'warning',
      title: 'Image preview failed',
      description: 'Tolaria could not render this image file in the preview.',
    }
  }

  if (previewKind === 'pdf') {
    return {
      icon: 'warning',
      title: 'PDF preview failed',
      description: 'Tolaria could not render this PDF file in the preview.',
    }
  }

  if (previewKind === 'docx') {
    return {
      icon: 'warning',
      title: 'Word preview failed',
      description: 'Tolaria could not render this Word document in the preview.',
    }
  }

  if (previewKind === 'xlsx') {
    return {
      icon: 'warning',
      title: 'Spreadsheet preview failed',
      description: 'Tolaria could not render this spreadsheet in the preview.',
    }
  }

  return {
    icon: 'file',
    title: 'Preview unavailable',
    description: 'Tolaria does not have an in-app preview for this file type.',
  }
}

function FilePreviewHeaderIcon({ previewKind }: { previewKind: FilePreviewKind | null }) {
  if (previewKind === 'image') {
    return <ImageSquare size={17} className="shrink-0 text-muted-foreground" aria-hidden="true" />
  }

  if (previewKind === 'pdf') {
    return <FilePdf size={17} className="shrink-0 text-muted-foreground" aria-hidden="true" />
  }

  if (previewKind === 'audio') {
    return <SpeakerHigh size={17} className="shrink-0 text-muted-foreground" aria-hidden="true" />
  }

  if (previewKind === 'video') {
    return <Video size={17} className="shrink-0 text-muted-foreground" aria-hidden="true" />
  }

  if (previewKind === 'docx') {
    return <FileDoc size={17} className="shrink-0 text-muted-foreground" aria-hidden="true" />
  }

  if (previewKind === 'xlsx') {
    return <FileXls size={17} className="shrink-0 text-muted-foreground" aria-hidden="true" />
  }

  return <FileDashed size={17} className="shrink-0 text-muted-foreground" aria-hidden="true" />
}

function FilePreviewFallback({ icon, title, description, onOpenExternal }: FilePreviewFallbackProps) {
  const Icon = icon === 'warning' ? WarningCircle : FileDashed

  return (
    <div
      className="flex h-full min-h-[260px] flex-col items-center justify-center gap-4 px-8 text-center"
      data-testid="file-preview-fallback"
    >
      <Icon size={34} className="text-muted-foreground" aria-hidden="true" />
      <div className="space-y-1">
        <h2 className="m-0 text-[15px] font-semibold text-foreground">{title}</h2>
        <p className="m-0 max-w-md text-[13px] leading-6 text-muted-foreground">{description}</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onOpenExternal}>
        <ArrowSquareOut size={15} />
        Open in default app
      </Button>
    </div>
  )
}

function FilePreviewHeader({
  entry,
  previewKind,
  fileTypeLabel,
  onOpenExternal,
  onRevealFile,
  onCopyFilePath,
}: {
  entry: VaultEntry
  previewKind: FilePreviewKind | null
  fileTypeLabel: string
  onOpenExternal: () => void
  onRevealFile?: () => void
  onCopyFilePath?: () => void
}) {
  return (
    <div
      className="flex h-[52px] shrink-0 items-center justify-between border-b border-border px-4"
      data-tauri-drag-region
    >
      <div className="flex min-w-0 items-center gap-2">
        <FilePreviewHeaderIcon previewKind={previewKind} />
        <div className="min-w-0">
          <h1 className="m-0 truncate text-[14px] font-semibold text-foreground">{entry.title}</h1>
          <p className="m-0 text-[11px] text-muted-foreground">{fileTypeLabel}</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        {onRevealFile && (
          <Button type="button" variant="ghost" size="sm" onClick={onRevealFile}>
            <FolderOpen size={15} />
            Reveal
          </Button>
        )}
        {onCopyFilePath && (
          <Button type="button" variant="ghost" size="sm" onClick={onCopyFilePath}>
            <ClipboardText size={15} />
            Copy path
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" onClick={onOpenExternal}>
          <ArrowSquareOut size={15} />
          Open
        </Button>
      </div>
    </div>
  )
}

function FilePreviewPdf({
  entry,
  pdfSrc,
  onOpenExternal,
}: {
  entry: VaultEntry
  pdfSrc: string
  onOpenExternal: () => void
}) {
  const fallback = fallbackContentForPreviewKind('pdf')

  return (
    <object
      data={pdfSrc}
      type="application/pdf"
      title={entry.title}
      className="h-full min-h-[320px] w-full bg-background"
      data-testid="pdf-file-preview"
    >
      <FilePreviewFallback
        icon={fallback.icon}
        title={fallback.title}
        description={fallback.description}
        onOpenExternal={onOpenExternal}
      />
    </object>
  )
}

function FilePreviewImage({
  entry,
  imageSrc,
  onImageError,
}: {
  entry: VaultEntry
  imageSrc: string
  onImageError: () => void
}) {
  return (
    <div className="flex h-full min-h-[260px] items-center justify-center p-6">
      <img
        src={imageSrc}
        alt={entry.title}
        className="max-h-full max-w-full object-contain"
        data-testid="image-file-preview"
        onError={onImageError}
      />
    </div>
  )
}

function FilePreviewMediaFrame({
  children,
  video = false,
}: {
  children: ReactNode
  video?: boolean
}) {
  return (
    <div className={`flex h-full items-center justify-center ${video ? 'min-h-[320px] bg-black p-4' : 'min-h-[260px] p-6'}`}>
      {children}
    </div>
  )
}

function FilePreviewMedia({
  entry,
  mediaKind,
  mediaSrc,
  onMediaError,
}: {
  entry: VaultEntry
  mediaKind: 'audio' | 'video'
  mediaSrc: string
  onMediaError: () => void
}) {
  if (mediaKind === 'audio') {
    return (
      <FilePreviewMediaFrame>
        <audio
          controls
          preload="metadata"
          src={mediaSrc}
          className="w-full max-w-2xl"
          data-testid="audio-file-preview"
          onError={onMediaError}
        />
      </FilePreviewMediaFrame>
    )
  }

  return (
    <FilePreviewMediaFrame video>
      <video
        controls
        preload="metadata"
        src={mediaSrc}
        title={entry.title}
        className="max-h-full max-w-full"
        data-testid="video-file-preview"
        onError={onMediaError}
      />
    </FilePreviewMediaFrame>
  )
}

function shouldRenderImagePreview(isImage: boolean, imageSrc: string | null, imageFailed: boolean): imageSrc is string {
  return isImage && imageSrc !== null && !imageFailed
}

async function fetchArrayBuffer(src: string): Promise<ArrayBuffer> {
  const response = await fetch(src)
  if (!response.ok) throw new Error(`Failed to load file (status ${response.status})`)
  return response.arrayBuffer()
}

function useSanitizedHtmlFragment<T extends HTMLElement>(rawHtml: string | null) {
  const ref = useRef<T | null>(null)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    while (node.firstChild) node.removeChild(node.firstChild)
    if (!rawHtml) return
    const fragment = DOMPurify.sanitize(rawHtml, { RETURN_DOM_FRAGMENT: true }) as unknown as DocumentFragment
    node.appendChild(fragment)
  }, [rawHtml])
  return ref
}

function FilePreviewLoading({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[260px] items-center justify-center px-8 text-center text-[13px] text-muted-foreground">
      {label}
    </div>
  )
}

function FilePreviewDocx({
  entry,
  assetSrc,
  onError,
  onOpenExternal,
}: {
  entry: VaultEntry
  assetSrc: string
  onError: () => void
  onOpenExternal: () => void
}) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    const node = containerRef.current
    if (node) {
      while (node.firstChild) node.removeChild(node.firstChild)
    }

    void (async () => {
      try {
        const buffer = await fetchArrayBuffer(assetSrc)
        const docxPreview = await import('docx-preview')
        if (cancelled || !containerRef.current) return
        await docxPreview.renderAsync(buffer, containerRef.current, undefined, {
          className: 'tolaria-docx',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          ignoreLastRenderedPageBreak: true,
          trimXmlDeclaration: true,
          useBase64URL: true,
          renderHeaders: true,
          renderFooters: true,
          renderFootnotes: true,
          renderEndnotes: true,
        })
        if (cancelled) return
        setStatus('ready')
      } catch (error) {
        if (cancelled) return
        console.warn('docx preview failed', error)
        setStatus('error')
        onError()
      }
    })()

    return () => {
      cancelled = true
    }
  }, [assetSrc, onError])

  if (status === 'error') {
    const fallback = fallbackContentForPreviewKind('docx')
    return (
      <FilePreviewFallback
        icon={fallback.icon}
        title={fallback.title}
        description={fallback.description}
        onOpenExternal={onOpenExternal}
      />
    )
  }

  return (
    <div className="relative h-full min-h-0 w-full overflow-auto bg-muted/30">
      {status === 'loading' && <FilePreviewLoading label="Rendering Word document…" />}
      <div
        ref={containerRef}
        className="mx-auto my-6 max-w-[920px] [&_.docx-wrapper]:bg-transparent [&_.docx-wrapper>section.docx]:mx-auto [&_.docx-wrapper>section.docx]:my-4 [&_.docx-wrapper>section.docx]:bg-background [&_.docx-wrapper>section.docx]:shadow-sm"
        data-testid="docx-file-preview"
        aria-label={`${entry.title} document content`}
      />
    </div>
  )
}

function FilePreviewXlsx({
  entry,
  assetSrc,
  onError,
  onOpenExternal,
}: {
  entry: VaultEntry
  assetSrc: string
  onError: () => void
  onOpenExternal: () => void
}) {
  const [sheets, setSheets] = useState<{ name: string; html: string }[] | null>(null)
  const [activeSheet, setActiveSheet] = useState(0)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const currentHtml = sheets ? sheets[activeSheet]?.html ?? sheets[0]?.html ?? '' : null
  const tableRef = useSanitizedHtmlFragment<HTMLDivElement>(currentHtml)

  useEffect(() => {
    let cancelled = false
    setSheets(null)
    setActiveSheet(0)
    setErrorMessage(null)

    void (async () => {
      try {
        const buffer = await fetchArrayBuffer(assetSrc)
        const XLSX = await import('xlsx')
        const workbook = XLSX.read(buffer, { type: 'array' })
        const rendered = workbook.SheetNames.map((name) => {
          const worksheet = workbook.Sheets[name]
          const html = XLSX.utils.sheet_to_html(worksheet, { editable: false })
          return { name, html }
        })
        if (cancelled) return
        setSheets(rendered)
      } catch (error) {
        if (cancelled) return
        console.warn('xlsx preview failed', error)
        setErrorMessage(error instanceof Error ? error.message : 'Unknown error')
        onError()
      }
    })()

    return () => {
      cancelled = true
    }
  }, [assetSrc, onError])

  if (errorMessage) {
    const fallback = fallbackContentForPreviewKind('xlsx')
    return (
      <FilePreviewFallback
        icon={fallback.icon}
        title={fallback.title}
        description={fallback.description}
        onOpenExternal={onOpenExternal}
      />
    )
  }

  if (sheets === null) {
    return <FilePreviewLoading label="Rendering spreadsheet…" />
  }

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="xlsx-file-preview" aria-label={`${entry.title} spreadsheet content`}>
      {sheets.length > 1 && (
        <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-muted/30 px-2 py-1">
          {sheets.map((sheet, index) => (
            <button
              key={sheet.name}
              type="button"
              onClick={() => setActiveSheet(index)}
              className={`whitespace-nowrap rounded-md px-2.5 py-1 text-[12px] transition-colors ${
                index === activeSheet ? 'bg-background font-semibold text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      )}
      <div
        ref={tableRef}
        className="xlsx-preview min-h-0 flex-1 overflow-auto px-4 py-3 text-[12px] [&_table]:border-collapse [&_table]:w-auto [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border [&_th]:bg-muted [&_th]:px-2 [&_th]:py-1 [&_th]:font-semibold"
      />
    </div>
  )
}

function FilePreviewBody({
  entry,
  previewKind,
  assetSrc,
  imageFailed,
  onImageError,
  onAudioError,
  onVideoError,
  onDocxError,
  onXlsxError,
  onOpenExternal,
}: {
  entry: VaultEntry
  previewKind: FilePreviewKind | null
  assetSrc: string | null
  imageFailed: boolean
  onImageError: () => void
  onAudioError: () => void
  onVideoError: () => void
  onDocxError: () => void
  onXlsxError: () => void
  onOpenExternal: () => void
}) {
  if (shouldRenderImagePreview(previewKind === 'image', assetSrc, imageFailed)) {
    return <FilePreviewImage entry={entry} imageSrc={assetSrc} onImageError={onImageError} />
  }

  if (previewKind === 'pdf' && assetSrc !== null) {
    return <FilePreviewPdf entry={entry} pdfSrc={assetSrc} onOpenExternal={onOpenExternal} />
  }

  if (previewKind === 'audio' && assetSrc !== null) {
    return <FilePreviewMedia entry={entry} mediaKind="audio" mediaSrc={assetSrc} onMediaError={onAudioError} />
  }

  if (previewKind === 'video' && assetSrc !== null) {
    return <FilePreviewMedia entry={entry} mediaKind="video" mediaSrc={assetSrc} onMediaError={onVideoError} />
  }

  if (previewKind === 'docx' && assetSrc !== null) {
    return <FilePreviewDocx entry={entry} assetSrc={assetSrc} onError={onDocxError} onOpenExternal={onOpenExternal} />
  }

  if (previewKind === 'xlsx' && assetSrc !== null) {
    return <FilePreviewXlsx entry={entry} assetSrc={assetSrc} onError={onXlsxError} onOpenExternal={onOpenExternal} />
  }

  const fallback = fallbackContentForPreviewKind(previewKind)

  return (
    <FilePreviewFallback
      icon={fallback.icon}
      title={fallback.title}
      description={fallback.description}
      onOpenExternal={onOpenExternal}
    />
  )
}

function useFilePreviewFailureState(entryPath: string) {
  const [failedImagePath, setFailedImagePath] = useState<string | null>(null)
  const [failedMediaPath, setFailedMediaPath] = useState<string | null>(null)

  const handleImageError = useCallback(() => {
    setFailedImagePath(entryPath)
    trackFilePreviewFailed('image')
  }, [entryPath])
  const handleAudioError = useCallback(() => {
    setFailedMediaPath(entryPath)
    trackFilePreviewFailed('audio')
  }, [entryPath])
  const handleVideoError = useCallback(() => {
    setFailedMediaPath(entryPath)
    trackFilePreviewFailed('video')
  }, [entryPath])
  const handleDocxError = useCallback(() => {
    trackFilePreviewFailed('docx')
  }, [])
  const handleXlsxError = useCallback(() => {
    trackFilePreviewFailed('xlsx')
  }, [])

  return {
    imageFailed: failedImagePath === entryPath,
    mediaFailed: failedMediaPath === entryPath,
    handleImageError,
    handleAudioError,
    handleVideoError,
    handleDocxError,
    handleXlsxError,
  }
}

function useFilePreviewActions({
  entryPath,
  onCopyFilePath,
  onOpenExternalFile,
  onRevealFile,
  previewKind,
}: {
  entryPath: string
  onCopyFilePath?: (path: string) => void
  onOpenExternalFile?: (path: string) => void
  onRevealFile?: (path: string) => void
  previewKind: FilePreviewKind | null
}) {
  const handleOpenExternal = useCallback(() => {
    trackFilePreviewAction('open_external', previewKind)
    if (onOpenExternalFile) {
      onOpenExternalFile(entryPath)
      return
    }

    void openLocalFile(entryPath).catch((error) => {
      console.warn('Failed to open file with default app:', error)
    })
  }, [entryPath, onOpenExternalFile, previewKind])

  const handleRevealFile = useCallback(() => {
    trackFilePreviewAction('reveal', previewKind)
    onRevealFile?.(entryPath)
  }, [entryPath, onRevealFile, previewKind])

  const handleCopyFilePath = useCallback(() => {
    trackFilePreviewAction('copy_path', previewKind)
    onCopyFilePath?.(entryPath)
  }, [entryPath, onCopyFilePath, previewKind])

  return { handleOpenExternal, handleRevealFile, handleCopyFilePath }
}

function previewKindForBody(previewKind: FilePreviewKind | null, mediaFailed: boolean): FilePreviewKind | null {
  return mediaFailed ? null : previewKind
}

export function FilePreview({
  entry,
  onCopyFilePath,
  onOpenExternalFile,
  onRevealFile,
}: FilePreviewProps) {
  const previewKind = filePreviewKind(entry)
  const assetSrc = useMemo(() => (previewKind ? convertFileSrc(entry.path) : null), [entry.path, previewKind])
  const fileTypeLabel = previewFileTypeLabel(entry)
  const failures = useFilePreviewFailureState(entry.path)
  const actions = useFilePreviewActions({
    entryPath: entry.path,
    onCopyFilePath,
    onOpenExternalFile,
    onRevealFile,
    previewKind,
  })

  useEffect(() => {
    trackFilePreviewOpened(previewKind)
  }, [entry.path, previewKind])

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return
    event.preventDefault()
    focusNoteListContainer(document)
  }, [])

  return (
    <section
      className="flex min-h-0 min-w-0 flex-1 flex-col bg-background text-foreground"
      data-testid="file-preview"
      tabIndex={0}
      role="group"
      aria-label={`Preview ${entry.title}`}
      onKeyDown={handleKeyDown}
    >
      <FilePreviewHeader
        entry={entry}
        previewKind={previewKind}
        fileTypeLabel={fileTypeLabel}
        onOpenExternal={actions.handleOpenExternal}
        onRevealFile={onRevealFile ? actions.handleRevealFile : undefined}
        onCopyFilePath={onCopyFilePath ? actions.handleCopyFilePath : undefined}
      />
      <div className="min-h-0 flex-1 overflow-auto bg-background">
        <FilePreviewBody
          entry={entry}
          previewKind={previewKindForBody(previewKind, failures.mediaFailed)}
          assetSrc={assetSrc}
          imageFailed={failures.imageFailed}
          onImageError={failures.handleImageError}
          onAudioError={failures.handleAudioError}
          onVideoError={failures.handleVideoError}
          onDocxError={failures.handleDocxError}
          onXlsxError={failures.handleXlsxError}
          onOpenExternal={actions.handleOpenExternal}
        />
      </div>
    </section>
  )
}
