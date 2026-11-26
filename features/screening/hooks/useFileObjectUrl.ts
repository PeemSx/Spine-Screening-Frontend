"use client";

import { useEffect, useState } from "react";

interface FileObjectUrlState {
  file: File | null;
  url: string | null;
}

const EMPTY_OBJECT_URL_STATE: FileObjectUrlState = {
  file: null,
  url: null,
};

/**
 * Creates a blob URL for the lifetime of the component displaying the file.
 * Queue state retains the File itself, so remounts and Fast Refresh always
 * create a fresh URL instead of reusing a revoked one.
 */
export function useFileObjectUrl(file: File | null) {
  const [state, setState] = useState<FileObjectUrlState>(
    EMPTY_OBJECT_URL_STATE,
  );

  useEffect(() => {
    if (!file) {
      setState(EMPTY_OBJECT_URL_STATE);
      return;
    }

    const url = URL.createObjectURL(file);
    setState({ file, url });

    return () => URL.revokeObjectURL(url);
  }, [file]);

  return state.file === file ? state.url : null;
}
