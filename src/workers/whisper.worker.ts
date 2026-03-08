// @ts-expect-error no types available
import { pipeline, env } from '@xenova/transformers';

// 允许跨域加载本地或HF模型
env.allowLocalModels = false;
env.useBrowserCache = true;

// Define a variable to hold the audio transcription pipeline
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let transcriber: any = null;

// Listen for messages from the main thread
self.addEventListener('message', async (event) => {
    const { type, audio } = event.data;

    if (type === 'load') {
        try {
            // "Xenova/whisper-tiny.en" is a small model specifically for English, ~40MB
            // Fast and accurate enough for IELTS speaking
            transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');

            // Send ready signal
            self.postMessage({ status: 'ready' });
        } catch (err: unknown) {
            self.postMessage({ status: 'error', error: (err as Error).message });
        }
    }
    else if (type === 'transcribe') {
        if (!transcriber) return;

        try {
            self.postMessage({ status: 'decoding' });

            // Run the model on the audio Float32Array
            const output = await transcriber(audio, {
                // Return timestamps or chunked output for real-time feel if needed
                chunk_length_s: 30,
                stride_length_s: 5,
            });

            self.postMessage({
                status: 'complete',
                text: output.text.trim()
            });

        } catch (err: unknown) {
            self.postMessage({ status: 'error', error: (err as Error).message });
        }
    }
});
