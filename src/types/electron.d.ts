type RomDialogResult = {
  name: string;
  path: string;
  data: ArrayBuffer;
};

declare global {
  interface Window {
    electronAPI?: {
      openRomDialog: () => Promise<RomDialogResult | null>;
      readRomFile: (filePath: string) => Promise<RomDialogResult | null>;
      setWindowFullscreen: (nextState: boolean) => Promise<boolean>;
      onWindowFullscreenChanged: (
        callback: (isFullscreen: boolean) => void,
      ) => () => void;
    };
  }
}

export {};
