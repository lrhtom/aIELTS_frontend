declare module 'speak-tts' {
  interface SpeakListeners {
    onend?: () => void;
    onerror?: (event?: unknown) => void;
  }

  interface SpeakOptions {
    text: string;
    queue?: boolean;
    listeners?: SpeakListeners;
  }

  interface InitOptions {
    lang?: string;
    voice?: string;
    volume?: number;
    rate?: number;
    pitch?: number;
    splitSentences?: boolean;
  }

  export default class Speech {
    constructor();
    hasBrowserSupport(): boolean;
    init(options?: InitOptions): Promise<void>;
    speak(options: SpeakOptions): Promise<void>;
    cancel(): void;
  }
}
