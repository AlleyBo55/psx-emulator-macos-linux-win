"use client";

import { startTransition, useEffect, useMemo, useRef, useState } from "react";

type RecentGame = {
  name: string;
  path?: string;
  size: number;
  lastOpenedAt: string;
};

type PendingLaunch = {
  file: File;
  path?: string;
  size: number;
  name: string;
  launchedAt: string;
};

const RECENTS_STORAGE_KEY = "aetherstation-recents";

const controlRows = [
  { action: "Move", key: "Arrow" },
  { action: "Cross", key: "Z" },
  { action: "Circle", key: "X" },
  { action: "Square", key: "S" },
  { action: "Triangle", key: "D" },
  { action: "L1 / L2", key: "W / E" },
  { action: "R1 / R2", key: "R / T" },
  { action: "Select / Start", key: "C / V" },
];

function formatFileSize(size: number) {
  if (size >= 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatLastOpened(timestamp: string) {
  return new Date(timestamp).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function ActionButton({
  children,
  onClick,
  disabled,
  emphasis = "secondary",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  emphasis?: "secondary" | "accent";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`apple-button ${emphasis === "accent" ? "apple-button-accent" : "apple-button-secondary"} inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium tracking-[-0.01em] transition disabled:cursor-not-allowed disabled:opacity-45`}
    >
      {children}
    </button>
  );
}

export default function Home() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const browserFileInputRef = useRef<HTMLInputElement>(null);
  const stagePanelRef = useRef<HTMLElement>(null);

  const [recents, setRecents] = useState<RecentGame[]>([]);
  const [activeGame, setActiveGame] = useState<RecentGame | null>(null);
  const [pendingLaunch, setPendingLaunch] = useState<PendingLaunch | null>(null);
  const [emulatorStatus, setEmulatorStatus] = useState(
    "Core cold booted. Choose a title to begin.",
  );
  const [frameKey, setFrameKey] = useState(0);
  const [isFrameReady, setIsFrameReady] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isImmersiveMode, setIsImmersiveMode] = useState(false);
  const [isControlsOverlayVisible, setIsControlsOverlayVisible] = useState(false);
  const [hasGamepad, setHasGamepad] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isElectronShell, setIsElectronShell] = useState(false);
  const [hasLoadedRecents, setHasLoadedRecents] = useState(false);

  useEffect(() => {
    setIsElectronShell(Boolean(window.electronAPI));

    const raw = window.localStorage.getItem(RECENTS_STORAGE_KEY);
    if (!raw) {
      setHasLoadedRecents(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setRecents(parsed as RecentGame[]);
      }
    } catch {
      window.localStorage.removeItem(RECENTS_STORAGE_KEY);
    } finally {
      setHasLoadedRecents(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedRecents) {
      return;
    }

    window.localStorage.setItem(RECENTS_STORAGE_KEY, JSON.stringify(recents));
  }, [recents, hasLoadedRecents]);

  useEffect(() => {
    const updateGamepads = () => {
      const connected = Array.from(navigator.getGamepads?.() ?? []).some(Boolean);
      setHasGamepad(connected);
    };

    updateGamepads();
    window.addEventListener("gamepadconnected", updateGamepads);
    window.addEventListener("gamepaddisconnected", updateGamepads);

    const pollId = window.setInterval(updateGamepads, 1500);

    return () => {
      window.removeEventListener("gamepadconnected", updateGamepads);
      window.removeEventListener("gamepaddisconnected", updateGamepads);
      window.clearInterval(pollId);
    };
  }, []);

  useEffect(() => {
    if (window.electronAPI?.onWindowFullscreenChanged) {
      return window.electronAPI.onWindowFullscreenChanged((nextState) => {
        setIsImmersiveMode(nextState);
      });
    }

    const handleFullscreenChange = () => {
      setIsImmersiveMode(Boolean(document.fullscreenElement));
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.repeat ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key !== "p" && key !== "o") {
        return;
      }

      const target = event.target;
      if (target instanceof HTMLElement) {
        const tagName = target.tagName;
        if (
          target.isContentEditable ||
          tagName === "INPUT" ||
          tagName === "TEXTAREA" ||
          tagName === "SELECT"
        ) {
          return;
        }
      }

      event.preventDefault();
      event.stopPropagation();
      setIsControlsOverlayVisible((current) => !current);
    };

    window.addEventListener("keydown", handleShortcut, true);

    return () => {
      window.removeEventListener("keydown", handleShortcut, true);
    };
  }, []);

  useEffect(() => {
    const forwardKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName;
        if (
          target.isContentEditable ||
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT"
        ) {
          return;
        }
      }

      const iframeWindow = iframeRef.current?.contentWindow;
      if (!iframeWindow) {
        return;
      }

      iframeWindow.postMessage(
        {
          type: "forward-key",
          eventType: event.type,
          key: event.key,
          code: event.code,
          keyCode: event.keyCode,
        },
        "*",
      );
    };

    window.addEventListener("keydown", forwardKey);
    window.addEventListener("keyup", forwardKey);

    return () => {
      window.removeEventListener("keydown", forwardKey);
      window.removeEventListener("keyup", forwardKey);
    };
  }, []);

  const sessionSummary = useMemo(() => {
    if (!activeGame) {
      return {
        title: "No disc loaded",
        subtitle: "Choose a disc image to boot a clean session.",
      };
    }

    return {
      title: activeGame.name,
      subtitle: `${formatFileSize(activeGame.size)} • ${formatLastOpened(activeGame.lastOpenedAt)}`,
    };
  }, [activeGame]);

  const persistRecent = (entry: RecentGame) => {
    setRecents((current) => {
      const identity = entry.path ?? `${entry.name}:${entry.size}`;
      const deduped = current.filter((game) => {
        const gameIdentity = game.path ?? `${game.name}:${game.size}`;
        return gameIdentity !== identity;
      });

      return [entry, ...deduped].slice(0, 6);
    });
  };

  const sendPendingLaunch = (launch: PendingLaunch) => {
    const iframeWindow = iframeRef.current?.contentWindow;

    if (!iframeWindow) {
      return;
    }

    iframeWindow.postMessage(
      {
        type: "load-rom",
        file: launch.file,
      },
      "*",
    );
    setEmulatorStatus(`Loading ${launch.name} into the core...`);
    setPendingLaunch(null);
    window.setTimeout(() => iframeRef.current?.focus(), 200);
  };

  const queueLaunch = (file: File, path?: string) => {
    const launchedAt = new Date().toISOString();
    const nextGame = {
      name: file.name,
      path,
      size: file.size,
      lastOpenedAt: launchedAt,
    };

    persistRecent(nextGame);
    setActiveGame(nextGame);
    setErrorMessage(null);

    const iframeWindow = iframeRef.current?.contentWindow;

    if (isFrameReady && iframeWindow) {
      iframeWindow.postMessage({ type: "load-rom", file }, "*");
      setEmulatorStatus(`Loading ${file.name} into the core...`);
      window.setTimeout(() => iframeRef.current?.focus(), 200);
      return;
    }

    setIsFrameReady(false);
    setEmulatorStatus("Preparing a clean emulator session...");

    startTransition(() => {
      setPendingLaunch({
        file,
        path,
        size: file.size,
        name: file.name,
        launchedAt,
      });
      setFrameKey((value) => value + 1);
    });
  };

  useEffect(() => {
    const listener = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      if (!event.data || typeof event.data !== "object") {
        return;
      }

      const payload = event.data as
        | { source?: string; type?: string; status?: string; message?: string }
        | undefined;

      if (payload?.source !== "aetherstation-emulator" || !payload.type) {
        return;
      }

      if (payload.type === "emulator-ready") {
        setIsFrameReady(true);

        if (pendingLaunch) {
          sendPendingLaunch(pendingLaunch);
          return;
        }

        setEmulatorStatus("Core ready. Choose a legally dumped PS1 disc image.");
        return;
      }

      if (payload.type === "emulator-status" && payload.status) {
        setEmulatorStatus(payload.status);
        return;
      }

      if (payload.type === "toggle-controls-overlay") {
        setIsControlsOverlayVisible((current) => !current);
        return;
      }

      if (payload.type === "emulator-error" && payload.message) {
        setErrorMessage(payload.message);
      }
    };

    window.addEventListener("message", listener);

    return () => {
      window.removeEventListener("message", listener);
    };
  }, [pendingLaunch]);

  const launchFromNativePicker = async () => {
    if (!window.electronAPI) {
      browserFileInputRef.current?.click();
      return;
    }

    const result = await window.electronAPI.openRomDialog();
    if (!result) {
      return;
    }

    const file = new File([result.data], result.name, {
      type: "application/octet-stream",
    });

    queueLaunch(file, result.path);
  };

  const launchFromRecent = async (game: RecentGame) => {
    if (!game.path) {
      setErrorMessage(
        "This recent title came from browser import, so it cannot be reopened automatically.",
      );
      return;
    }

    if (!window.electronAPI) {
      setErrorMessage(
        "Reopening recent games from disk requires the Electron desktop shell.",
      );
      return;
    }

    const result = await window.electronAPI.readRomFile(game.path);
    if (!result) {
      setErrorMessage("The saved path is no longer available on disk.");
      return;
    }

    const file = new File([result.data], result.name, {
      type: "application/octet-stream",
    });

    queueLaunch(file, result.path);
  };

  const handleBrowserInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    queueLaunch(file);
    event.target.value = "";
  };

  const handleDrop = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }

    queueLaunch(file);
  };

  const resetCore = () => {
    setPendingLaunch(null);
    setActiveGame(null);
    setErrorMessage(null);
    setIsFrameReady(false);
    setEmulatorStatus("Core reset. Choose another disc image.");
    setFrameKey((value) => value + 1);
  };

  const toggleFullscreen = async () => {
    const nextState = !isImmersiveMode;

    if (window.electronAPI?.setWindowFullscreen) {
      const result = await window.electronAPI.setWindowFullscreen(nextState);
      setIsImmersiveMode(result);
      return;
    }

    if (!document.fullscreenElement) {
      await stagePanelRef.current?.requestFullscreen();
      setIsImmersiveMode(true);
      return;
    }

    await document.exitFullscreen();
    setIsImmersiveMode(false);
  };

  const keyboardHint = hasGamepad
    ? "Controller detected. Press P or O to reveal keyboard fallback."
    : "Press P or O any time to show or hide the keyboard map.";
  const compactRecents = recents.slice(0, 3);

  return (
    <main className="h-screen overflow-hidden p-2 sm:p-3">
      <input
        ref={browserFileInputRef}
        type="file"
        accept=".bin,.img,.iso,.mdf"
        className="hidden"
        onChange={handleBrowserInput}
      />

      <section
        className={`aether-shell mx-auto flex h-full max-w-[1920px] flex-col overflow-hidden ${
          isImmersiveMode ? "rounded-none" : "rounded-[30px]"
        }`}
      >
        <header className="aether-toolbar flex items-start justify-between gap-4 px-4 py-3 sm:px-5" style={{ WebkitAppRegion: "drag" } as React.CSSProperties}>
          <div className="min-w-0 flex-1">
            <p className="aether-eyebrow">AetherStation</p>
            <h1 className="mt-1 truncate text-2xl font-semibold tracking-[-0.05em] text-[#20180f] sm:text-[30px]">
              PlayStation
            </h1>
            <p className="mt-1 text-sm text-[#6b5541]">
              {activeGame
                ? sessionSummary.subtitle
                : "Open a disc image or drop one onto the stage."}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2" style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
            <span className={`aether-chip ${isFrameReady ? "aether-chip-ready" : ""}`}>
              {isFrameReady ? "Core ready" : "Booting"}
            </span>
            <span className="aether-chip hidden md:inline-flex">
              {isElectronShell ? "Desktop shell" : "Web mode"}
            </span>
            <span className="aether-chip hidden md:inline-flex">
              {hasGamepad ? "Controller connected" : "Keyboard active"}
            </span>
            <ActionButton emphasis="accent" onClick={launchFromNativePicker}>
              Open Game
            </ActionButton>
            <ActionButton onClick={() => browserFileInputRef.current?.click()}>
              Import
            </ActionButton>
          </div>
        </header>

        <div
          className={`grid min-h-0 flex-1 gap-3 p-3 ${
            isImmersiveMode ? "grid-cols-1" : "lg:grid-cols-[280px_minmax(0,1fr)]"
          }`}
        >
          <aside className={`${isImmersiveMode ? "hidden" : "hidden lg:flex"} min-h-0 flex-col`}>
            <section className="aether-panel aether-panel-sidebar flex min-h-0 flex-1 flex-col rounded-[26px] p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="aether-eyebrow">Library</p>
                <span className="aether-chip">{recents.length} recent</span>
              </div>

              <div className="mt-3 grid gap-2">
                <ActionButton emphasis="accent" onClick={launchFromNativePicker}>
                  Open From Finder
                </ActionButton>
                <ActionButton onClick={() => browserFileInputRef.current?.click()}>
                  Import Disc Image
                </ActionButton>
              </div>

              <div className="aether-subtile mt-3 rounded-[18px] px-3 py-3">
                <p className="text-sm font-semibold text-[#1f180f]">
                  {hasGamepad ? "Controller connected" : "Keyboard active"}
                </p>
                <p className="mt-1 text-xs leading-5 text-[#715f4f]">{keyboardHint}</p>
              </div>

              <div className="mt-4 flex items-center justify-between">
                <p className="aether-eyebrow">Recent</p>
                {recents.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setRecents([])}
                    className="cursor-pointer text-[11px] font-medium text-[#8f7a68] transition hover:text-[#c0392b]"
                  >
                    Clear all
                  </button>
                ) : (
                  <span className="text-xs text-[#8f7a68]">{isFrameReady ? "Ready" : "Booting"}</span>
                )}
              </div>

              <div className="scrollbar-subtle mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {recents.length === 0 ? (
                  <div className="aether-subtile rounded-[18px] px-3 py-3 text-sm leading-6 text-[#6f5d4a]">
                    No recent sessions yet.
                  </div>
                ) : null}

                {recents.map((game) => (
                  <div
                    key={`${game.path ?? game.name}-${game.lastOpenedAt}`}
                    className="library-row group relative w-full cursor-pointer rounded-[18px] px-3 py-3 text-left"
                  >
                    <button
                      type="button"
                      onClick={() => void launchFromRecent(game)}
                      className="w-full text-left"
                    >
                      <p className="truncate pr-5 text-sm font-semibold text-[#1f180f]">{game.name}</p>
                      <p className="mt-1 text-xs text-[#7b6856]">
                        {formatFileSize(game.size)} {game.path ? "• local" : "• imported"}
                      </p>
                      <p className="mt-2 text-[11px] text-[#8f7a68]">
                        {formatLastOpened(game.lastOpenedAt)}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setRecents((current) =>
                          current.filter(
                            (item) =>
                              item.lastOpenedAt !== game.lastOpenedAt || item.name !== game.name,
                          ),
                        );
                      }}
                      className="absolute right-2 top-2 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full text-[#9a8572] opacity-0 transition hover:bg-[#fde7dc] hover:text-[#c0392b] group-hover:opacity-100"
                      aria-label={`Remove ${game.name}`}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </aside>

          <section className="min-h-0 flex flex-col">
            {!isImmersiveMode ? (
              <div className="aether-panel mb-3 rounded-[20px] p-3 lg:hidden">
                <div className="flex items-center justify-between gap-3">
                  <p className="aether-eyebrow">Quick Recents</p>
                  <span className="aether-chip">{recents.length}</span>
                </div>
                <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                  {compactRecents.length === 0 ? (
                    <div className="aether-subtile rounded-[14px] px-3 py-2 text-xs text-[#7b6856]">
                      No recent sessions
                    </div>
                  ) : (
                    compactRecents.map((game) => (
                      <button
                        key={`compact-${game.path ?? game.name}-${game.lastOpenedAt}`}
                        type="button"
                        onClick={() => void launchFromRecent(game)}
                        className="aether-subtile shrink-0 rounded-[14px] px-3 py-2 text-left"
                      >
                        <p className="max-w-[180px] truncate text-xs font-semibold text-[#1f180f]">
                          {game.name}
                        </p>
                      </button>
                    ))
                  )}
                </div>
              </div>
            ) : null}

            <section
              ref={stagePanelRef}
              className={
                isImmersiveMode
                  ? "fixed inset-0 z-50 flex flex-col bg-[#120c08] p-3 sm:p-4"
                  : "aether-panel aether-stage-panel flex min-h-0 flex-1 flex-col overflow-hidden rounded-[30px] p-3 sm:p-4"
              }
            >
              <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
                <div className="flex shrink-0 items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className={`aether-eyebrow ${isImmersiveMode ? "text-[#f5deca]/75" : ""}`}>
                      Now Playing
                    </p>
                    <h2
                      className={`mt-1 truncate text-xl font-semibold tracking-[-0.04em] sm:text-2xl ${
                        isImmersiveMode ? "text-[#fef2e7]" : "text-[#20180f]"
                      }`}
                    >
                      {sessionSummary.title}
                    </h2>
                    <p className={`mt-1 text-sm ${isImmersiveMode ? "text-[#e9cdb5]/75" : "text-[#695440]"}`}>
                      {activeGame
                        ? sessionSummary.subtitle
                        : "Open from Finder, import a file, or drag a disc image onto the stage."}
                    </p>
                    <p className={`mt-1 text-xs ${isImmersiveMode ? "text-[#d9b89b]/65" : "text-[#826b56]"}`}>
                      {emulatorStatus}
                    </p>
                    {errorMessage ? (
                      <p
                        className={`mt-2 rounded-[12px] px-3 py-1.5 text-xs ${
                          isImmersiveMode
                            ? "border border-rose-300/25 bg-rose-400/15 text-rose-100"
                            : "border border-rose-300/40 bg-rose-50 text-rose-700"
                        }`}
                      >
                        {errorMessage}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-2 text-sm">
                    <button
                      type="button"
                      onClick={resetCore}
                      className={`aether-ghost-action ${
                        isImmersiveMode ? "text-[#f4dcc8]/78 hover:text-[#fdf4ec]" : ""
                      }`}
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleFullscreen()}
                      disabled={!isFrameReady}
                      className={`aether-ghost-action disabled:cursor-not-allowed disabled:opacity-35 ${
                        isImmersiveMode ? "text-[#f4dcc8]/78 hover:text-[#fdf4ec]" : ""
                      }`}
                    >
                      {isImmersiveMode ? "Exit Fullscreen" : "Fullscreen"}
                    </button>
                  </div>
                </div>

                <div
                  className={`relative min-h-0 flex-1 ${isDragging ? "ring-2 ring-[#ebba88]/70" : ""}`}
                  onDragEnter={() => setIsDragging(true)}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                >
                  <div
                    className={
                      isImmersiveMode
                        ? "aether-stage-wrap h-full min-h-0 w-full p-0"
                        : "aether-stage-wrap h-full min-h-0 w-full"
                    }
                  >
                    <div className="aether-stage-screen relative flex h-full min-h-0 w-full items-center justify-center overflow-hidden rounded-[24px] bg-black">
                      {isControlsOverlayVisible ? (
                        <div className="aether-overlay absolute bottom-4 left-4 z-10 w-[280px] rounded-[18px] px-3 py-3 text-white">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[10px] uppercase tracking-[0.24em] text-white/56">
                              Keyboard Map
                            </p>
                            <span className="aether-overlay-hint rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.18em]">
                              P / O
                            </span>
                          </div>

                          <div className="mt-3 space-y-1.5">
                            {controlRows.map((row) => (
                              <div
                                key={row.action}
                                className="aether-overlay-row flex items-center justify-between rounded-[12px] px-3 py-2.5"
                              >
                                <span className="text-xs text-white/65">{row.action}</span>
                                <span className="text-sm font-semibold text-white">{row.key}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="aether-overlay-hint absolute bottom-4 right-4 z-10 rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.2em]">
                          P / O controls
                        </div>
                      )}

                      <iframe
                        key={frameKey}
                        ref={iframeRef}
                        src="emulator/index.html"
                        title="PS1 emulator"
                        className="h-full w-auto max-h-full max-w-full aspect-[4/3] bg-black"
                        allowFullScreen
                        onLoad={() => iframeRef.current?.focus()}
                        onClick={() => iframeRef.current?.focus()}
                      />

                      {!activeGame ? (
                        <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
                          <div className="max-w-md">
                            <p className="text-2xl font-semibold tracking-[-0.05em] text-[#ffefe0]">
                              Ready for a disc image.
                            </p>
                            <p className="mt-3 text-sm leading-6 text-[#ecd0b6]/80">
                              Open from Finder, import a file, or drag a `.bin`, `.img`, `.iso`,
                              or `.mdf` image onto this screen.
                            </p>
                            <p className="mt-3 text-xs text-[#d5b494]/75">{keyboardHint}</p>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </section>
        </div>
      </section>
    </main>
  );
}
