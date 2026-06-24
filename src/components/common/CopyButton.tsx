/**
 * CopyButton — Copies text to clipboard with success feedback.
 */

import { useState, useCallback } from 'react';
import { IconButton, Tooltip } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';

interface CopyButtonProps {
  /** The text to copy */
  text: string;
  /** Icon button size */
  size?: 'small' | 'medium' | 'large';
  /** Optional tooltip title override */
  title?: string;
}

export function CopyButton({
  text,
  size = 'small',
  title,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [text]);

  return (
    <Tooltip title={title ?? (copied ? '已复制' : '复制')}>
      <span>
        <IconButton onClick={handleCopy} size={size} disabled={!text}>
          {copied ? (
            <CheckIcon fontSize="small" color="success" />
          ) : (
            <ContentCopyIcon fontSize="small" />
          )}
        </IconButton>
      </span>
    </Tooltip>
  );
}

/**
 * Copies text to clipboard using the async Clipboard API,
 * with a fallback to the legacy execCommand approach.
 */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to fallback
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const result = document.execCommand('copy');
    document.body.removeChild(textarea);
    return result;
  } catch {
    return false;
  }
}
