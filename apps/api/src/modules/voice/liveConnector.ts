import { GoogleGenAI, Modality, type LiveServerMessage } from '@google/genai'

export interface ToolDeclaration {
  name: string
  description?: string
  parametersJsonSchema: unknown
}

export interface ToolCall {
  id: string
  name: string
  args: Record<string, unknown>
}

export interface LiveEvents {
  /** A modell hangja: base64 PCM, 24 kHz. */
  onAudio(base64: string): void
  onInterrupted(): void
  onTurnComplete(): void
  onToolCalls(calls: ToolCall[]): void
  onTranscript(role: 'user' | 'assistant', text: string): void
  onError(err: unknown): void
  onClose(): void
}

export interface LiveSession {
  /** Nyers PCM, 16 bites LE, mono, 16 kHz. */
  sendAudio(pcm: Buffer): void
  sendAudioEnd(): void
  sendToolResponses(
    responses: { id: string; name: string; response: Record<string, unknown> }[],
  ): void
  close(): void
}

export interface LiveConnectParams {
  systemInstruction: string
  tools: ToolDeclaration[]
}

/** A modellhíd felülete; a Gemini Live megvalósítás mellett tesztben cserélhető. */
export interface LiveConnector {
  connect(params: LiveConnectParams, events: LiveEvents): Promise<LiveSession>
}

/** Gemini Live (`@google/genai`) megvalósítás. */
export function createGeminiLiveConnector(opts: { apiKey: string; model: string }): LiveConnector {
  const ai = new GoogleGenAI({ apiKey: opts.apiKey })
  return {
    async connect(params, events) {
      const session = await ai.live.connect({
        model: opts.model,
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: params.systemInstruction,
          tools: [{ functionDeclarations: params.tools }],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onmessage: (m: LiveServerMessage) => {
            const sc = m.serverContent
            for (const part of sc?.modelTurn?.parts ?? []) {
              if (part.inlineData?.data) events.onAudio(part.inlineData.data)
            }
            if (sc?.inputTranscription?.text)
              events.onTranscript('user', sc.inputTranscription.text)
            if (sc?.outputTranscription?.text)
              events.onTranscript('assistant', sc.outputTranscription.text)
            if (sc?.interrupted) events.onInterrupted()
            if (sc?.turnComplete) events.onTurnComplete()
            if (m.toolCall?.functionCalls?.length) {
              events.onToolCalls(
                m.toolCall.functionCalls.map((c) => ({
                  id: c.id ?? c.name ?? '',
                  name: c.name ?? '',
                  args: (c.args ?? {}) as Record<string, unknown>,
                })),
              )
            }
          },
          onerror: (e) => events.onError(e),
          onclose: () => events.onClose(),
        },
      })
      return {
        sendAudio: (pcm) =>
          session.sendRealtimeInput({
            audio: { data: pcm.toString('base64'), mimeType: 'audio/pcm;rate=16000' },
          }),
        sendAudioEnd: () => session.sendRealtimeInput({ audioStreamEnd: true }),
        sendToolResponses: (functionResponses) => session.sendToolResponse({ functionResponses }),
        close: () => session.close(),
      }
    },
  }
}
