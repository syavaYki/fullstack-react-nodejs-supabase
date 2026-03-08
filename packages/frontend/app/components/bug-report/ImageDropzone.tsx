import { useCallback, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CloseIcon from '@mui/icons-material/Close';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_FILES = 5;

interface ImageDropzoneProps {
  images: File[];
  onChange: (images: File[]) => void;
  error?: string;
}

export default function ImageDropzone({ images, onChange, error }: ImageDropzoneProps) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (incoming: FileList | null) => {
      if (!incoming) return;

      const valid: File[] = [];
      for (const file of Array.from(incoming)) {
        if (!ALLOWED_TYPES.includes(file.type)) continue;
        if (file.size > MAX_SIZE_BYTES) continue;
        // Deduplicate by name + size
        const isDup = images.some((f) => f.name === file.name && f.size === file.size);
        if (isDup) continue;
        valid.push(file);
      }

      const merged = [...images, ...valid].slice(0, MAX_FILES);
      onChange(merged);
    },
    [images, onChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      addFiles(e.dataTransfer.files);
    },
    [addFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => setDragging(false), []);

  const removeImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  return (
    <Box>
      <Box
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => inputRef.current?.click()}
        sx={{
          border: '2px dashed',
          borderColor: error ? 'error.main' : dragging ? 'primary.main' : 'divider',
          borderRadius: 2,
          p: 3,
          textAlign: 'center',
          cursor: 'pointer',
          bgcolor: dragging ? 'action.hover' : 'background.default',
          transition: 'all 0.2s ease',
          '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
        }}
      >
        <CloudUploadIcon color={dragging ? 'primary' : 'disabled'} sx={{ fontSize: 36, mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          Drag &amp; drop images here, or click to browse
        </Typography>
        <Typography variant="caption" color="text.secondary">
          JPEG, PNG, GIF, WebP · Max 10 MB each · Up to {MAX_FILES} files
        </Typography>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => addFiles(e.target.files)}
        />
      </Box>

      {error && (
        <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
          {error}
        </Typography>
      )}

      {images.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1.5 }}>
          {images.map((file, index) => {
            const url = URL.createObjectURL(file);
            return (
              <Box
                key={`${file.name}-${file.size}`}
                sx={{
                  position: 'relative',
                  width: 80,
                  height: 80,
                  borderRadius: 1,
                  overflow: 'hidden',
                }}
              >
                <Box
                  component="img"
                  src={url}
                  alt={file.name}
                  sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onLoad={() => URL.revokeObjectURL(url)}
                />
                <IconButton
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(index);
                  }}
                  sx={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    bgcolor: 'rgba(0,0,0,0.6)',
                    color: 'white',
                    p: 0.25,
                    '&:hover': { bgcolor: 'rgba(0,0,0,0.8)' },
                  }}
                >
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
